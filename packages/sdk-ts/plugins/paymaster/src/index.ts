/**
 * @stablenet/plugin-paymaster
 *
 * Paymaster plugins for StableNet SDK
 *
 * Supports:
 * - VerifyingPaymaster: Off-chain signature based gas sponsorship
 * - SponsorPaymaster: API-based gas sponsorship
 * - Permit2Paymaster: Token-based gas payment using Uniswap Permit2
 *
 * All paymaster data is encoded in envelope format (version byte 0x01)
 * using the core paymaster module from @stablenet/core.
 *
 * @example
 * ```ts
 * import {
 *   createVerifyingPaymaster,
 *   createSponsorPaymaster,
 *   createPermit2Paymaster,
 * } from '@stablenet/plugin-paymaster'
 *
 * // Using verifying paymaster with local signer
 * const verifyingPaymaster = createVerifyingPaymaster({
 *   paymasterAddress: '0x...',
 *   signer: privateKeyToAccount('0x...'),
 *   chainId: 1n,
 * })
 *
 * // Using sponsor paymaster with API
 * const sponsorPaymaster = createSponsorPaymaster({
 *   paymasterUrl: 'https://paymaster.example.com',
 *   apiKey: 'your-api-key',
 *   chainId: 1n,
 * })
 *
 * // Using Permit2 paymaster for token-based gas payment
 * const permit2Paymaster = createPermit2Paymaster({
 *   paymasterAddress: '0x...',
 *   permit2Address: '0x...',
 *   tokenAddress: '0x...', // ERC20 token for gas payment
 *   signer: privateKeyToAccount('0x...'),
 *   chainId: 1n,
 * })
 *
 * // Use with smart account client
 * const client = createSmartAccountClient({
 *   account,
 *   chain,
 *   transport,
 *   paymaster: verifyingPaymaster,
 * })
 * ```
 */

// Permit2 Paymaster (Token-based gas payment)
export {
  createPermit2Paymaster,
  createPermit2PaymasterFromPrivateKey,
  decodePermit2PaymasterData,
  getPermit2Nonce,
} from './permit2Paymaster'
// Sponsor Paymaster (API-based)
export {
  createSponsorPaymaster,
  createSponsorPaymasterWithPolicy,
  type SponsorshipPolicy,
} from './sponsorPaymaster'
// Plugin types
export type {
  ERC20PaymasterConfig,
  PaymasterGasEstimation,
  PaymasterType,
  Permit2PaymasterConfig,
  SponsorPaymasterConfig,
  VerifyingPaymasterConfig,
} from './types'
// Constants
export { DEFAULT_VALIDITY_SECONDS } from './types'
// Verifying Paymaster
export {
  createVerifyingPaymaster,
  createVerifyingPaymasterFromPrivateKey,
} from './verifyingPaymaster'

// Re-export core paymaster types and utilities for convenience
export {
  type PaymasterDataEnvelope,
  PaymasterType as CorePaymasterType,
  encodePaymasterData,
  decodePaymasterData,
  encodePaymasterDataWithSignature,
  splitEnvelopeAndSignature,
  isPaymasterDataSupported,
  PAYMASTER_DATA_VERSION,
  HEADER_SIZE,
} from '@stablenet/core'
