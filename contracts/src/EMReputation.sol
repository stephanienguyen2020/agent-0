// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Execution Market — Reputation Registry
contract EMReputation is AccessControl {
    bytes32 public constant EM_AGENT_ROLE = keccak256("EM_AGENT_ROLE");

    struct Reputation {
        uint64 tasksCompleted;
        uint64 tasksDisputed;
        uint64 disputeLosses;
        uint128 totalEarnedUsdc6;
        int64 score;
        uint32 categoriesBitmap;
        uint64 lastUpdated;
    }

    mapping(uint256 => Reputation) public reputation;

    event ReputationRecorded(
        uint256 indexed agentId, uint64 tasksCompleted, uint64 tasksDisputed, int64 score
    );

    constructor(address admin, address emAgent) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EM_AGENT_ROLE, emAgent);
    }

    function recordCompletion(uint256 agentId, uint8 category, uint128 earnedUsdc6, int64 deltaScore)
        external
        onlyRole(EM_AGENT_ROLE)
    {
        Reputation storage r = reputation[agentId];
        r.tasksCompleted += 1;
        r.totalEarnedUsdc6 += earnedUsdc6;
        r.score += deltaScore;
        r.categoriesBitmap |= uint32(1 << category);
        r.lastUpdated = uint64(block.timestamp);
        emit ReputationRecorded(agentId, r.tasksCompleted, r.tasksDisputed, r.score);
    }

    function recordDispute(uint256 agentId, bool agentLost, int64 deltaScore)
        external
        onlyRole(EM_AGENT_ROLE)
    {
        Reputation storage r = reputation[agentId];
        r.tasksDisputed += 1;
        if (agentLost) r.disputeLosses += 1;
        r.score += deltaScore;
        r.lastUpdated = uint64(block.timestamp);
        emit ReputationRecorded(agentId, r.tasksCompleted, r.tasksDisputed, r.score);
    }

    function getReputation(uint256 agentId) external view returns (Reputation memory) {
        return reputation[agentId];
    }

    function ratingBps(uint256 agentId) external view returns (uint256) {
        Reputation storage r = reputation[agentId];
        if (r.tasksCompleted == 0) return 0;
        int256 avg = int256(r.score) * 1000 / int256(uint256(r.tasksCompleted));
        if (avg < 0) avg = 0;
        if (avg > 5000) avg = 5000;
        return uint256(avg);
    }
}
