/**
 * @stablenet/plugin-session-keys
 *
 * Session Keys plugin for StableNet SDK
 *
 * Enables delegated execution via session keys with:
 * - Time-bounded sessions (validAfter, validUntil)
 * - Target contract restrictions
 * - Function selector whitelisting
 * - Value (ETH) spending limits per session
 * - Nonce-based replay protection
 *
 * @example
 * ```ts
 * import {
 *   createSessionKeyExecutor,
 *   generateSessionKey,
 * } from '@stablenet/plugin-session-keys'
 * import { parseEther } from 'viem'
 *
 * // Create executor client
 * const executor = createSessionKeyExecutor({
 *   executorAddress: '0x...',
 *   chainId: 1n,
 * })
 *
 * // Generate a new session key
 * const sessionKey = await generateSessionKey()
 *
 * // Encode add session key transaction
 * const addKeyData = executor.encodeAddSessionKey({
 *   account: smartAccountAddress,
 *   sessionKey,
 *   validUntil: BigInt(Date.now() / 1000 + 3600), // 1 hour
 *   spendingLimit: parseEther('0.1'), // 0.1 ETH max
 *   permissions: [
 *     { target: tokenAddress, selector: '0xa9059cbb' }, // transfer
 *   ],
 * })
 *
 * // Grant additional permission
 * const grantData = executor.encodeGrantPermission(sessionKey.address, {
 *   target: dexAddress,
 *   selector: '0x38ed1739', // swapExactTokensForTokens
 *   maxValue: parseEther('0.01'),
 * })
 *
 * // Execute as session key
 * const execData = executor.encodeExecuteAsSessionKey(smartAccountAddress, {
 *   target: tokenAddress,
 *   value: 0n,
 *   data: '0x...',
 * })
 *
 * // Or sign and execute on behalf
 * const state = await executor.getSessionKeyState(publicClient, smartAccountAddress, sessionKey.address)
 * const signature = await executor.signExecution(sessionKey, smartAccountAddress, request, state.config.nonce)
 * const execOnBehalfData = executor.encodeExecuteOnBehalf(smartAccountAddress, request, signature)
 * ```
 */

// Session Key Executor
export {
  createSessionKeyExecutor,
  generateSessionKey,
  type SessionKeyExecutorClient,
  sessionKeyFromPrivateKey,
} from './sessionKeyExecutor'
// Types
export type {
  CreateSessionKeyParams,
  ExecutionRequest,
  Permission,
  PermissionInput,
  SessionKeyConfig,
  SessionKeyExecutorConfig,
  SessionKeyState,
} from './types'
export { SESSION_KEY_EXECUTOR_ABI } from './types'
