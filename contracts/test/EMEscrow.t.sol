// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {EMEscrow} from "../src/EMEscrow.sol";

contract EMEscrowTest is Test {
    MockUSDC usdc;
    EMEscrow escrow;
    address admin = address(0xA11CE);
    address emAgent = address(0xB0B);
    address treasury = address(0x7E0);
    address agent = address(0xAAA);
    address executor = address(0xEEE);

    function setUp() public {
        vm.startPrank(admin);
        usdc = new MockUSDC();
        escrow = new EMEscrow(address(usdc), emAgent, treasury, 1300, admin);
        vm.stopPrank();

        vm.prank(agent);
        usdc.mint(1000e6);
        vm.prank(agent);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_publishTask_locksFunds() public {
        bytes32 taskId = keccak256("task-1");
        vm.prank(emAgent);
        escrow.publishTask(
            taskId, agent, 123, EMEscrow.Category.PhysicalPresence, 100e6, uint64(block.timestamp + 1 hours)
        );

        EMEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(uint256(t.status), uint256(EMEscrow.TaskStatus.Published));
        assertEq(t.bounty, 100e6);
        assertEq(t.platformFee, 13e6);
        assertEq(usdc.balanceOf(address(escrow)), 113e6);
    }

    function test_fullLifecycle() public {
        bytes32 taskId = keccak256("task-2");
        vm.startPrank(emAgent);
        escrow.publishTask(
            taskId, agent, 1, EMEscrow.Category.PhysicalPresence, 100e6, uint64(block.timestamp + 1 hours)
        );
        escrow.acceptTask(taskId, executor, 2);
        escrow.submitEvidence(taskId, keccak256("evidence"), "https://gnfd/foo.png");
        escrow.markVerified(taskId);
        escrow.release(taskId);
        vm.stopPrank();

        assertEq(usdc.balanceOf(executor), 100e6);
        assertEq(usdc.balanceOf(treasury), 13e6);
    }

    function test_refundExpired() public {
        bytes32 taskId = keccak256("task-3");
        vm.prank(emAgent);
        escrow.publishTask(
            taskId, agent, 1, EMEscrow.Category.PhysicalPresence, 50e6, uint64(block.timestamp + 1 hours)
        );

        vm.warp(block.timestamp + 2 hours);
        escrow.refundExpired(taskId);

        EMEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(uint256(t.status), uint256(EMEscrow.TaskStatus.Expired));
        assertEq(usdc.balanceOf(agent), 1000e6);
    }

    function test_dispute_executorWins() public {
        bytes32 taskId = keccak256("task-4");
        vm.startPrank(emAgent);
        escrow.publishTask(
            taskId, agent, 1, EMEscrow.Category.PhysicalPresence, 80e6, uint64(block.timestamp + 1 hours)
        );
        escrow.acceptTask(taskId, executor, 2);
        escrow.submitEvidence(taskId, bytes32(0), "https://gnfd/x");
        escrow.dispute(taskId, "fake photo");
        escrow.resolveDispute(taskId, true);
        vm.stopPrank();

        assertEq(usdc.balanceOf(executor), 80e6);
        assertEq(usdc.balanceOf(treasury), uint256(80e6 * 1300 / 10000));
    }

    function testFuzz_feeAlwaysCorrect(uint128 bounty) public {
        bounty = uint128(bound(bounty, 1e6, 100e6));
        bytes32 taskId = keccak256(abi.encode(bounty));
        vm.prank(emAgent);
        escrow.publishTask(
            taskId, agent, 1, EMEscrow.Category.PhysicalPresence, bounty, uint64(block.timestamp + 1 hours)
        );
        EMEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(t.platformFee, uint256(bounty) * 1300 / 10000);
    }
}
