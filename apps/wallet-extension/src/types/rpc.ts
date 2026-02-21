import type { Address, Hex } from 'viem'

/**
 * RPC types for JSON-RPC communication
 */

/**
 * JSON-RPC request
 */
export interface JsonRpcRequest<T = unknown[]> {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: T
}

/**
 * JSON-RPC response
 */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: JsonRpcError
}

/**
 * JSON-RPC error
 */
export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * Supported RPC methods
 */
export type SupportedMethod =
  // Account methods
  | 'eth_accounts'
  | 'eth_requestAccounts'
  // Chain methods
  | 'eth_chainId'
  | 'wallet_switchEthereumChain'
  | 'wallet_addEthereumChain'
  // Signing methods
  | 'personal_sign'
  | 'eth_signTypedData_v4'
  // Transaction methods
  | 'eth_sendTransaction'
  | 'eth_getTransactionReceipt'
  | 'eth_getTransactionByHash'
  // UserOperation methods (ERC-4337)
  | 'eth_sendUserOperation'
  | 'eth_estimateUserOperationGas'
  | 'eth_getUserOperationByHash'
  | 'eth_getUserOperationReceipt'
  | 'eth_supportedEntryPoints'
  | 'debug_bundler_getUserOperationStatus'
  // Read methods
  | 'eth_getBalance'
  | 'eth_call'
  | 'eth_blockNumber'
  | 'eth_getCode'
  | 'eth_getLogs'
  | 'eth_getBlockByNumber'
  | 'eth_getBlockByHash'
  | 'eth_gasPrice'
  | 'eth_maxPriorityFeePerGas'
  | 'eth_feeHistory'
  | 'eth_estimateGas'
  | 'eth_getTransactionCount'
  | 'eth_sendRawTransaction'
  // Network methods
  | 'net_version'
  // Permission methods
  | 'wallet_requestPermissions'
  | 'wallet_getPermissions'
  // Module management methods (ERC-7579)
  | 'stablenet_installModule'
  | 'stablenet_uninstallModule'
  // Smart Account management
  | 'stablenet_getSmartAccountInfo'
  | 'stablenet_getRegistryModules'
  | 'stablenet_getInstalledModules'
  | 'stablenet_speedUpTransaction'
  | 'stablenet_cancelTransaction'
  | 'stablenet_setRootValidator'
  // Swap methods
  | 'stablenet_executeSwap'
  // Gas estimation
  | 'stablenet_estimateGas'
  // EntryPoint deposit
  | 'stablenet_getEntryPointBalance'
  | 'stablenet_depositToEntryPoint'
  // Paymaster methods
  | 'pm_registerAccount'
  | 'pm_accountStatus'

/**
 * RPC method parameters
 */

// eth_requestAccounts
export type RequestAccountsParams = []
export type RequestAccountsResult = Address[]

// eth_chainId
export type ChainIdParams = []
export type ChainIdResult = Hex

// wallet_switchEthereumChain
export type SwitchChainParams = [{ chainId: Hex }]
export type SwitchChainResult = null

// wallet_addEthereumChain
export type AddChainParams = [
  {
    chainId: Hex
    chainName: string
    nativeCurrency: {
      name: string
      symbol: string
      decimals: number
    }
    rpcUrls: string[]
    blockExplorerUrls?: string[]
    iconUrls?: string[]
  },
]
export type AddChainResult = null

// personal_sign
export type PersonalSignParams = [Hex, Address]
export type PersonalSignResult = Hex

// eth_signTypedData_v4
export type SignTypedDataParams = [Address, string]
export type SignTypedDataResult = Hex

// eth_sendTransaction
export interface RpcTransactionRequest {
  from: Address
  to?: Address
  value?: Hex
  data?: Hex
  gas?: Hex
  gasPrice?: Hex
  maxFeePerGas?: Hex
  maxPriorityFeePerGas?: Hex
  nonce?: Hex
}
export type SendTransactionParams = [RpcTransactionRequest]
export type SendTransactionResult = Hex

// eth_getBalance
export type GetBalanceParams = [Address, Hex | 'latest' | 'pending' | 'earliest']
export type GetBalanceResult = Hex

// eth_call
export interface CallRequest {
  from?: Address
  to: Address
  data?: Hex
  value?: Hex
  gas?: Hex
}
export type CallParams = [CallRequest, Hex | 'latest' | 'pending' | 'earliest']
export type CallResult = Hex

/**
 * UserOperation types (ERC-4337)
 */
export interface UserOperation {
  sender: Address
  nonce: Hex
  factory?: Address
  factoryData?: Hex
  callData: Hex
  callGasLimit: Hex
  verificationGasLimit: Hex
  preVerificationGas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: Hex
  paymaster?: Address
  paymasterVerificationGasLimit?: Hex
  paymasterPostOpGasLimit?: Hex
  paymasterData?: Hex
  signature: Hex
}

export interface PackedUserOperation {
  sender: Address
  nonce: Hex
  initCode: Hex
  callData: Hex
  accountGasLimits: Hex
  preVerificationGas: Hex
  gasFees: Hex
  paymasterAndData: Hex
  signature: Hex
}

// eth_sendUserOperation
export type SendUserOperationParams = [UserOperation | PackedUserOperation, Address]
export type SendUserOperationResult = Hex // userOpHash

// eth_getUserOperationReceipt
export interface UserOperationReceipt {
  userOpHash: Hex
  entryPoint: Address
  sender: Address
  nonce: Hex
  paymaster?: Address
  actualGasCost: Hex
  actualGasUsed: Hex
  success: boolean
  reason?: string
  logs: Log[]
  receipt: TransactionReceipt
}

export interface Log {
  address: Address
  topics: Hex[]
  data: Hex
  blockNumber: Hex
  transactionHash: Hex
  transactionIndex: Hex
  blockHash: Hex
  logIndex: Hex
  removed: boolean
}

export interface TransactionReceipt {
  transactionHash: Hex
  transactionIndex: Hex
  blockHash: Hex
  blockNumber: Hex
  from: Address
  to?: Address
  cumulativeGasUsed: Hex
  gasUsed: Hex
  contractAddress?: Address
  logs: Log[]
  logsBloom: Hex
  status: Hex
  effectiveGasPrice: Hex
}
