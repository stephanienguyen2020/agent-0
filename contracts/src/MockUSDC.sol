// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title MockUSDC with EIP-3009 for x402
/// @notice Test USDC for Execution Market. Implements EIP-3009 transferWithAuthorization
///         so the x402 facilitator can settle payments gaslessly on behalf of agents.
contract MockUSDC is ERC20, EIP712 {
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    /// @dev nonce => used (per EIP-3009)
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    error AuthorizationExpired();
    error AuthorizationNotYetValid();
    error AuthorizationAlreadyUsed();
    error InvalidSignature();

    constructor() ERC20("MockUSDC", "USDC") EIP712("MockUSDC", "1") {}

    /// @notice Mint test tokens to anyone (for hackathon convenience)
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Expose EIP-712 domain separator for off-chain signing / tests.
    function eip712DomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice EIP-3009: receive a signed authorization and execute the transfer
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp <= validAfter) revert AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert AuthorizationExpired();
        if (authorizationState[from][nonce]) revert AuthorizationAlreadyUsed();

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        if (signer != from) revert InvalidSignature();

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        _transfer(from, to, value);
    }
}
