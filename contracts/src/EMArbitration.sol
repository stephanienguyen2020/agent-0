// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Agent Zero — Tiered Arbitration (SCAFFOLD)
contract EMArbitration is AccessControl {
    bytes32 public constant EM_AGENT_ROLE = keccak256("EM_AGENT_ROLE");

    struct ArbitrationCase {
        bytes32 taskId;
        uint256 stakeRequired;
        uint256 panelSize;
        uint256 votesFor;
        uint256 votesAgainst;
        bool resolved;
    }

    mapping(bytes32 => ArbitrationCase) public cases;
    mapping(address => uint256) public stakes;

    event CaseOpened(bytes32 indexed taskId, uint256 stakeRequired);
    event CaseResolved(bytes32 indexed taskId, bool executorWins);

    constructor(address admin, address emAgent) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EM_AGENT_ROLE, emAgent);
    }

    function openCase(bytes32 taskId, uint256 stakeRequired) external onlyRole(EM_AGENT_ROLE) {
        cases[taskId] = ArbitrationCase({
            taskId: taskId,
            stakeRequired: stakeRequired,
            panelSize: 0,
            votesFor: 0,
            votesAgainst: 0,
            resolved: false
        });
        emit CaseOpened(taskId, stakeRequired);
    }

    function resolveCase(bytes32 taskId, bool executorWins) external onlyRole(EM_AGENT_ROLE) {
        ArbitrationCase storage c = cases[taskId];
        require(!c.resolved, "resolved");
        c.resolved = true;
        emit CaseResolved(taskId, executorWins);
    }
}
