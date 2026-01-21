/**
 * @stablenet/plugin-paymaster
 *
 * Paymaster plugins for StableNet SDK
 *
 * Supports:
 * - VerifyingPaymaster: Off-chain signature based gas sponsorship
 * - SponsorPaymaster: API-based gas sponsorship
 *
 * @example
 * ```ts
 * import {
 *   createVerifyingPaymaster,
 *   createSponsorPaymaster,
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
  PaymasterType,
  PaymasterGasEstimation,
  VerifyingPaymasterData,
  ERC20PaymasterData,
} from './types'

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
