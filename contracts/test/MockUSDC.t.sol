// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
contract MockUSDCTest is Test {
    MockUSDC usdc;
    uint256 internal userPk = 0xC0FFEE;
    address user;

    function setUp() public {
        usdc = new MockUSDC();
        user = vm.addr(userPk);
        vm.prank(user);
        usdc.mint(1000e6);
    }

    function test_transferWithAuthorization_succeeds() public {
        address to = address(0xBEEF);
        uint256 value = 10e6;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 days;
        bytes32 nonce = keccak256("nonce-1");

        bytes32 structHash = keccak256(
            abi.encode(
                usdc.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                user,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.eip712DomainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);

        usdc.transferWithAuthorization(user, to, value, validAfter, validBefore, nonce, v, r, s);

        assertEq(usdc.balanceOf(to), value);
    }
}
