// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal view for ERC-8004 registry (BSC testnet).
interface IERC8004Registry {
    function ownerOf(uint256 tokenId) external view returns (address);
}
