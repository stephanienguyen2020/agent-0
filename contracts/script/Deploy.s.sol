// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {EMEscrow} from "../src/EMEscrow.sol";
import {EMReputation} from "../src/EMReputation.sol";
import {EMArbitration} from "../src/EMArbitration.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address emAgent = vm.envAddress("EM_AGENT_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerKey);

        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:", address(usdc));
        usdc.mint(1_000_000 * 1e6);

        EMReputation rep = new EMReputation(deployer, emAgent);
        console.log("EMReputation:", address(rep));

        EMArbitration arb = new EMArbitration(deployer, emAgent);
        console.log("EMArbitration:", address(arb));

        EMEscrow escrow = new EMEscrow(address(usdc), emAgent, treasury, 1300, deployer);
        console.log("EMEscrow:", address(escrow));

        vm.stopBroadcast();
    }
}
