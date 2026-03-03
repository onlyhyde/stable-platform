/**
 * SignatureRouter — routes UserOp signing to the correct validator.
 *
 * Sits between handler.ts and keyringController, dispatching to
 * ECDSA (keyring), WebAuthn (bridge), or MultiSig (collector) based
 * on the active validator type from ValidatorRegistry.
 */

import type { Address, Hex } from 'viem'
import type {
  ValidatorRegistry,
  ValidatorTypeConfig,
  WebAuthnConfig,
  MultiSigConfig,
} from './validatorRegistry'
import type { WebAuthnBridge } from './webauthnBridge'

// ============================================================================
// Type Guards
// ============================================================================

function isWebAuthnConfig(cfg: ValidatorTypeConfig): cfg is WebAuthnConfig {
  return (
    cfg != null &&
    typeof cfg === 'object' &&
    'type' in cfg &&
    cfg.type === 'webauthn' &&
    'credentialId' in cfg &&
    typeof cfg.credentialId === 'string'
  )
}

function isMultiSigConfig(cfg: ValidatorTypeConfig): cfg is MultiSigConfig {
  return (
    cfg != null &&
    typeof cfg === 'object' &&
    'type' in cfg &&
    cfg.type === 'multisig' &&
    'signers' in cfg &&
    Array.isArray(cfg.signers) &&
    'threshold' in cfg &&
    typeof cfg.threshold === 'number'
  )
}

// ============================================================================
// Types
// ============================================================================

export interface SignatureRouterConfig {
  registry: ValidatorRegistry
  /** ECDSA signing via keyring (existing keyringController.signMessage) */
  ecdsaSign: (account: Address, hash: Hex) => Promise<Hex>
  /** WebAuthn signing bridge */
  webauthnBridge: WebAuthnBridge
  /** MultiSig signature collection (placeholder for future implementation) */
  multisigCollect?: (hash: Hex, signers: Address[], threshold: number) => Promise<Hex>
}

export interface SignatureRouter {
  /** Route a hash to the correct signing mechanism based on active validator */
  signHash(chainId: number, account: Address, hash: Hex): Promise<Hex>
}

// ============================================================================
// Implementation
// ============================================================================

export function createSignatureRouter(config: SignatureRouterConfig): SignatureRouter {
  const { registry, ecdsaSign, webauthnBridge, multisigCollect } = config

  const signHash = async (
    chainId: number,
    account: Address,
    hash: Hex
  ): Promise<Hex> => {
    const activeConfig = registry.getActiveValidator(chainId, account)

    switch (activeConfig.validatorType) {
      case 'ecdsa':
        return ecdsaSign(account, hash)

      case 'webauthn': {
        if (!isWebAuthnConfig(activeConfig.config)) {
          throw new Error('Invalid WebAuthn config: missing required fields')
        }
        return webauthnBridge.sign(hash, {
          credentialId: activeConfig.config.credentialId,
          pubKeyX: activeConfig.config.pubKeyX,
          pubKeyY: activeConfig.config.pubKeyY,
        })
      }

      case 'multisig': {
        if (!multisigCollect) {
          throw new Error('MultiSig signing not configured')
        }
        if (!isMultiSigConfig(activeConfig.config)) {
          throw new Error('Invalid MultiSig config: missing required fields')
        }
        return multisigCollect(hash, activeConfig.config.signers, activeConfig.config.threshold)
      }

      default:
        throw new Error(`Unknown validator type: ${activeConfig.validatorType}`)
    }
  }

  return { signHash }
}
