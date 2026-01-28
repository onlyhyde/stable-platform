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

// Types
export type {
  VerifyingPaymasterConfig,
  ERC20PaymasterConfig,
  SponsorPaymasterConfig,
  Permit2PaymasterConfig,
  PaymasterType,
  PaymasterGasEstimation,
  VerifyingPaymasterData,
  ERC20PaymasterData,
} from './types'

// Constants
export { DEFAULT_VALIDITY_SECONDS } from './types'

// Verifying Paymaster
export {
  createVerifyingPaymaster,
  createVerifyingPaymasterFromPrivateKey,
} from './verifyingPaymaster'

// Sponsor Paymaster (API-based)
export {
  createSponsorPaymaster,
  createSponsorPaymasterWithPolicy,
  type SponsorshipPolicy,
} from './sponsorPaymaster'

// Permit2 Paymaster (Token-based gas payment)
export {
  createPermit2Paymaster,
  createPermit2PaymasterFromPrivateKey,
  decodePermit2PaymasterData,
  getPermit2Nonce,
} from './permit2Paymaster'
