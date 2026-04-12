// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {EMReputation} from "../src/EMReputation.sol";

contract EMReputationTest is Test {
    EMReputation rep;
    address admin = address(0xA11CE);
    address emAgent = address(0xB0B);

    function setUp() public {
        vm.prank(admin);
        rep = new EMReputation(admin, emAgent);
    }

    function test_recordCompletion() public {
        vm.prank(emAgent);
        rep.recordCompletion(42, 0, 100e6, 10);
        EMReputation.Reputation memory r = rep.getReputation(42);
        assertEq(r.tasksCompleted, 1);
        assertEq(r.score, 10);
    }
}
