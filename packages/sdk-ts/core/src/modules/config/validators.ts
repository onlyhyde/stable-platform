/**
 * Validator Module Definitions
 *
 * ERC-7579 Module Type 1: Validators
 * Responsible for validating signatures and authorizations.
 */

import { MODULE_TYPE } from '@stablenet/sdk-types'
import type { Address } from 'viem'
import {
  createModuleEntry,
  DEFAULT_SUPPORTED_CHAINS,
  type ModuleRegistryEntry,
  SUPPORTED_CHAIN_IDS,
} from './types'

// ============================================================================
// ECDSA Validator
// ============================================================================

/**
 * ECDSA Validator module definition
 * Standard ECDSA signature validation for EOA-like security
 */
export const ECDSA_VALIDATOR: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.VALIDATOR,
    name: 'ECDSA Validator',
    description: 'Standard ECDSA signature validation for EOA-like security',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['validator', 'ecdsa', 'default'],
    docsUrl: 'https://docs.stablenet.io/modules/ecdsa-validator',
  },
  {
    version: '1.0.0',
    fields: [
      {
        name: 'owner',
        label: 'Owner Address',
        description: 'The address that can sign transactions',
        type: 'address',
        required: true,
      },
    ],
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0xd9AB5096a832b9ce79914329DAEE236f8Eea0390' as Address,
    [SUPPORTED_CHAIN_IDS.STABLENET]: '0xb33dc2d82eaee723ca7687d70209ed9a861b3b46' as Address,
  },
  DEFAULT_SUPPORTED_CHAINS
)

// ============================================================================
// WebAuthn Validator
// ============================================================================

/**
 * WebAuthn Validator module definition
 * Passkey authentication using WebAuthn/FIDO2
 */
export const WEBAUTHN_VALIDATOR: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.VALIDATOR,
    name: 'WebAuthn Validator',
    description: 'Passkey authentication using WebAuthn/FIDO2',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['validator', 'webauthn', 'passkey', 'biometric'],
    docsUrl: 'https://docs.stablenet.io/modules/webauthn-validator',
  },
  {
    version: '1.0.0',
    fields: [
      {
        name: 'pubKeyX',
        label: 'Public Key X',
        description: 'X coordinate of the WebAuthn public key',
        type: 'uint256',
        required: true,
      },
      {
        name: 'pubKeyY',
        label: 'Public Key Y',
        description: 'Y coordinate of the WebAuthn public key',
        type: 'uint256',
        required: true,
      },
      {
        name: 'credentialId',
        label: 'Credential ID',
        description: 'WebAuthn credential identifier',
        type: 'bytes',
        required: true,
      },
    ],
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.STABLENET]: '0x169844994bd5b64c3a264c54d6b0863bb7df0487' as Address,
  },
  DEFAULT_SUPPORTED_CHAINS
)

// ============================================================================
// MultiSig Validator
// ============================================================================

/**
 * MultiSig Validator module definition
 * Multi-signature validation requiring M-of-N signatures
 */
export const MULTISIG_VALIDATOR: ModuleRegistryEntry = createModuleEntry(
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    type: MODULE_TYPE.VALIDATOR,
    name: 'MultiSig Validator',
    description: 'Multi-signature validation requiring M-of-N signatures',
    version: '1.0.0',
    author: 'StableNet',
    isVerified: true,
    tags: ['validator', 'multisig', 'security'],
    docsUrl: 'https://docs.stablenet.io/modules/multisig-validator',
  },
  {
    version: '1.0.0',
    fields: [
      {
        name: 'signers',
        label: 'Signers',
        description: 'List of authorized signer addresses',
        type: 'address[]',
        required: true,
      },
      {
        name: 'threshold',
        label: 'Threshold',
        description: 'Number of required signatures',
        type: 'uint8',
        required: true,
        validation: {
          min: '1',
          message: 'Threshold must be at least 1',
        },
      },
    ],
  },
  {
    [SUPPORTED_CHAIN_IDS.MAINNET]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.SEPOLIA]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.LOCAL]: '0x0000000000000000000000000000000000000000' as Address,
    [SUPPORTED_CHAIN_IDS.STABLENET]: '0x284d8e1d4864bfab4ea1dfe283f7f849c075bfa5' as Address,
  },
  DEFAULT_SUPPORTED_CHAINS
)

// ============================================================================
// All Validators
// ============================================================================

/**
 * All built-in validator modules
 */
export const VALIDATOR_MODULES: ModuleRegistryEntry[] = [
  ECDSA_VALIDATOR,
  WEBAUTHN_VALIDATOR,
  MULTISIG_VALIDATOR,
]
