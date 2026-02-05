export {
  createEcdsaValidator,
  createEcdsaValidatorFromPrivateKey,
  serializeEcdsaValidator,
  type CreateEcdsaValidatorConfig,
  type EcdsaValidator,
} from './ecdsaValidator'

// Re-export types for convenience
export type { Validator } from '@stablenet/sdk-types'
export { ECDSA_VALIDATOR_ADDRESS } from '@stablenet/sdk-types'
