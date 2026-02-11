// Re-export types for convenience
export type { Validator } from '@stablenet/sdk-types'
export { ECDSA_VALIDATOR_ADDRESS } from '@stablenet/sdk-types'
export {
  type CreateEcdsaValidatorConfig,
  createEcdsaValidator,
  createEcdsaValidatorFromPrivateKey,
  type EcdsaValidator,
  serializeEcdsaValidator,
} from './ecdsaValidator'
