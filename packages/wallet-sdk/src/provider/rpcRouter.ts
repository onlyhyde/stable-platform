/**
 * RPC method routing.
 *
 * Classifies each RPC method into one of three categories:
 * - wallet:   requires user approval (signing, sending tx, etc.)
 * - cache:    can be served from local state (eth_accounts, eth_chainId)
 * - readonly: pure read calls that don't need wallet connection
 */

export type RpcRoute = 'wallet' | 'cache' | 'readonly'

/** Methods that MUST go through the wallet provider (require user interaction) */
const WALLET_METHODS = new Set([
  'eth_requestAccounts',
  'eth_sendTransaction',
  'eth_sendRawTransaction',
  'personal_sign',
  'eth_sign',
  'eth_signTypedData_v4',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
  'wallet_requestPermissions',
  'wallet_getPermissions',
  'wallet_revokePermissions',
  'wallet_watchAsset',
  // StableNet custom methods
  'wallet_signAuthorization',
  'wallet_getDelegationStatus',
  'wallet_getInstalledModules',
  'wallet_installModule',
  'wallet_uninstallModule',
  'wallet_forceUninstallModule',
  'wallet_replaceModule',
  'wallet_isModuleInstalled',
  'wallet_createSessionKey',
  'wallet_getSessionKeys',
  'wallet_revokeSessionKey',
  'wallet_generateStealthAddress',
  'wallet_scanStealthPayments',
  'wallet_getStealthMetaAddress',
  'wallet_sendUserOperation',
  'wallet_estimateUserOperationGas',
  'wallet_getUserOperationReceipt',
  'wallet_getPaymasterData',
  'wallet_sponsorUserOperation',
  'wallet_getAssets',
  'wallet_addToken',
])

/** Methods that can be served from local cached state */
const CACHED_METHODS = new Set([
  'eth_accounts',
  'eth_chainId',
])

/** Read-only methods that don't need wallet connection */
const READ_ONLY_METHODS = new Set([
  'eth_call',
  'eth_getBalance',
  'eth_blockNumber',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getLogs',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'net_version',
])

/**
 * Determine the routing target for an RPC method.
 */
export function routeRpcMethod(method: string): RpcRoute {
  if (CACHED_METHODS.has(method)) return 'cache'
  if (WALLET_METHODS.has(method)) return 'wallet'
  if (READ_ONLY_METHODS.has(method)) return 'readonly'
  // Unknown methods default to wallet (safe fallback)
  return 'wallet'
}
