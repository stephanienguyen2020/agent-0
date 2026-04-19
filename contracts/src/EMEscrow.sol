// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Agent Zero — Task Escrow
/// @notice Holds USDC bounty + fee for each task; releases on verification.
contract EMEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant EM_AGENT_ROLE = keccak256("EM_AGENT_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum TaskStatus {
        None,
        Published,
        Accepted,
        Submitted,
        Verified,
        Completed,
        Disputed,
        Refunded,
        Expired
    }

    enum Category {
        PhysicalPresence,
        KnowledgeAccess,
        HumanAuthority,
        SimpleAction,
        DigitalPhysical
    }

    struct Task {
        bytes32 taskId;
        address agent;
        uint256 agentErc8004Id;
        address executor;
        uint256 executorErc8004Id;
        Category category;
        uint256 bounty;
        uint256 platformFee;
        uint64 deadline;
        TaskStatus status;
        bytes32 evidenceHash;
        string evidenceURI;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint16 public feeBps;

    /// @notice USDC notionally locked for non-terminal tasks (bounty + fee per task).
    uint256 public totalUSDCCommitted;

    mapping(bytes32 => Task) public tasks;

    event TaskPublished(
        bytes32 indexed taskId,
        address indexed agent,
        uint256 indexed agentErc8004Id,
        Category category,
        uint256 bounty,
        uint64 deadline
    );
    event TaskAccepted(bytes32 indexed taskId, address indexed executor, uint256 indexed executorErc8004Id);
    event TaskSubmitted(bytes32 indexed taskId, bytes32 evidenceHash, string evidenceURI);
    event TaskVerified(bytes32 indexed taskId);
    event TaskCompleted(bytes32 indexed taskId, uint256 paidToExecutor, uint256 paidToTreasury);
    event TaskDisputed(bytes32 indexed taskId, string reason);
    event TaskRefunded(bytes32 indexed taskId);
    event TaskExpired(bytes32 indexed taskId);
    event TreasuryUpdated(address indexed newTreasury);
    event FeeBpsUpdated(uint16 newFeeBps);

    error TaskAlreadyExists();
    error TaskNotFound();
    error InvalidStatus(TaskStatus expected, TaskStatus actual);
    error DeadlinePassed();
    error InvalidExecutor();
    error InvalidFee();
    error InsufficientFreeUSDC();

    constructor(address _usdc, address _emAgent, address _treasury, uint16 _feeBps, address _admin) {
        require(_feeBps <= 5000, "fee > 50%");
        usdc = IERC20(_usdc);
        treasury = _treasury;
        feeBps = _feeBps;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(EM_AGENT_ROLE, _emAgent);
    }

    function publishTask(
        bytes32 taskId,
        address agent,
        uint256 agentErc8004Id,
        Category category,
        uint256 bounty,
        uint64 deadline
    ) external nonReentrant whenNotPaused onlyRole(EM_AGENT_ROLE) {
        if (tasks[taskId].status != TaskStatus.None) revert TaskAlreadyExists();
        if (deadline <= block.timestamp) revert DeadlinePassed();

        uint256 fee = (bounty * feeBps) / 10_000;
        uint256 total = bounty + fee;

        usdc.safeTransferFrom(agent, address(this), total);
        totalUSDCCommitted += total;

        tasks[taskId] = Task({
            taskId: taskId,
            agent: agent,
            agentErc8004Id: agentErc8004Id,
            executor: address(0),
            executorErc8004Id: 0,
            category: category,
            bounty: bounty,
            platformFee: fee,
            deadline: deadline,
            status: TaskStatus.Published,
            evidenceHash: bytes32(0),
            evidenceURI: ""
        });

        emit TaskPublished(taskId, agent, agentErc8004Id, category, bounty, deadline);
    }

    /// @notice Same as publishTask but USDC is already in this contract (e.g. EIP-3009 x402 settle to escrow).
    function publishTaskX402(
        bytes32 taskId,
        address agent,
        uint256 agentErc8004Id,
        Category category,
        uint256 bounty,
        uint64 deadline
    ) external nonReentrant whenNotPaused onlyRole(EM_AGENT_ROLE) {
        if (tasks[taskId].status != TaskStatus.None) revert TaskAlreadyExists();
        if (deadline <= block.timestamp) revert DeadlinePassed();

        uint256 fee = (bounty * feeBps) / 10_000;
        uint256 total = bounty + fee;

        if (usdc.balanceOf(address(this)) < totalUSDCCommitted + total) revert InsufficientFreeUSDC();

        totalUSDCCommitted += total;

        tasks[taskId] = Task({
            taskId: taskId,
            agent: agent,
            agentErc8004Id: agentErc8004Id,
            executor: address(0),
            executorErc8004Id: 0,
            category: category,
            bounty: bounty,
            platformFee: fee,
            deadline: deadline,
            status: TaskStatus.Published,
            evidenceHash: bytes32(0),
            evidenceURI: ""
        });

        emit TaskPublished(taskId, agent, agentErc8004Id, category, bounty, deadline);
    }

    function acceptTask(bytes32 taskId, address executor, uint256 executorErc8004Id)
        external
        whenNotPaused
        onlyRole(EM_AGENT_ROLE)
    {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Published) revert InvalidStatus(TaskStatus.Published, t.status);
        if (block.timestamp >= t.deadline) revert DeadlinePassed();
        if (executor == address(0)) revert InvalidExecutor();

        t.executor = executor;
        t.executorErc8004Id = executorErc8004Id;
        t.status = TaskStatus.Accepted;

        emit TaskAccepted(taskId, executor, executorErc8004Id);
    }

    function submitEvidence(bytes32 taskId, bytes32 evidenceHash, string calldata evidenceURI)
        external
        whenNotPaused
        onlyRole(EM_AGENT_ROLE)
    {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Accepted) revert InvalidStatus(TaskStatus.Accepted, t.status);

        t.evidenceHash = evidenceHash;
        t.evidenceURI = evidenceURI;
        t.status = TaskStatus.Submitted;

        emit TaskSubmitted(taskId, evidenceHash, evidenceURI);
    }

    function markVerified(bytes32 taskId) external whenNotPaused onlyRole(EM_AGENT_ROLE) {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Submitted) revert InvalidStatus(TaskStatus.Submitted, t.status);
        t.status = TaskStatus.Verified;
        emit TaskVerified(taskId);
    }

    function release(bytes32 taskId) external nonReentrant whenNotPaused onlyRole(EM_AGENT_ROLE) {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Verified) revert InvalidStatus(TaskStatus.Verified, t.status);

        t.status = TaskStatus.Completed;
        totalUSDCCommitted -= t.bounty + t.platformFee;
        usdc.safeTransfer(t.executor, t.bounty);
        usdc.safeTransfer(treasury, t.platformFee);

        emit TaskCompleted(taskId, t.bounty, t.platformFee);
    }

    function dispute(bytes32 taskId, string calldata reason) external whenNotPaused onlyRole(EM_AGENT_ROLE) {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Submitted && t.status != TaskStatus.Verified) {
            revert InvalidStatus(TaskStatus.Submitted, t.status);
        }
        t.status = TaskStatus.Disputed;
        emit TaskDisputed(taskId, reason);
    }

    function resolveDispute(bytes32 taskId, bool executorWins)
        external
        nonReentrant
        whenNotPaused
        onlyRole(EM_AGENT_ROLE)
    {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Disputed) revert InvalidStatus(TaskStatus.Disputed, t.status);

        if (executorWins) {
            t.status = TaskStatus.Completed;
            totalUSDCCommitted -= t.bounty + t.platformFee;
            usdc.safeTransfer(t.executor, t.bounty);
            usdc.safeTransfer(treasury, t.platformFee);
            emit TaskCompleted(taskId, t.bounty, t.platformFee);
        } else {
            t.status = TaskStatus.Refunded;
            totalUSDCCommitted -= t.bounty + t.platformFee;
            usdc.safeTransfer(t.agent, t.bounty + t.platformFee);
            emit TaskRefunded(taskId);
        }
    }

    function refundExpired(bytes32 taskId) external nonReentrant whenNotPaused {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Published) revert InvalidStatus(TaskStatus.Published, t.status);
        require(block.timestamp >= t.deadline, "not yet expired");

        t.status = TaskStatus.Expired;
        totalUSDCCommitted -= t.bounty + t.platformFee;
        usdc.safeTransfer(t.agent, t.bounty + t.platformFee);
        emit TaskExpired(taskId);
        emit TaskRefunded(taskId);
    }

    function cancel(bytes32 taskId) external nonReentrant whenNotPaused onlyRole(EM_AGENT_ROLE) {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Published) revert InvalidStatus(TaskStatus.Published, t.status);

        t.status = TaskStatus.Refunded;
        totalUSDCCommitted -= t.bounty + t.platformFee;
        usdc.safeTransfer(t.agent, t.bounty + t.platformFee);
        emit TaskRefunded(taskId);
    }

    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setFeeBps(uint16 newFeeBps) external onlyRole(ADMIN_ROLE) {
        if (newFeeBps > 5000) revert InvalidFee();
        feeBps = newFeeBps;
        emit FeeBpsUpdated(newFeeBps);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }
}
