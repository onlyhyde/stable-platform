import type { Address, Hex } from 'viem'

/**
 * Approval types for user consent flows
 */

export type ApprovalType =
  | 'connect'
  | 'signature'
  | 'transaction'
  | 'permission'
  | 'switchNetwork'
  | 'addNetwork'
  | 'authorization'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

/**
 * Base approval request
 */
export interface BaseApprovalRequest {
  id: string
  type: ApprovalType
  status: ApprovalStatus
  origin: string
  favicon?: string
  timestamp: number
  expiresAt?: number
}

/**
 * Connect approval (eth_requestAccounts)
 */
export interface ConnectApprovalRequest extends BaseApprovalRequest {
  type: 'connect'
  data: {
    requestedPermissions: string[]
    warnings?: string[]
    riskLevel?: 'low' | 'medium' | 'high'
  }
  result?: {
    accounts: Address[]
    permissions: string[]
  }
}

/**
 * Signature approval (personal_sign, eth_signTypedData_v4)
 */
export interface SignatureApprovalRequest extends BaseApprovalRequest {
  type: 'signature'
  data: {
    method: 'personal_sign' | 'eth_signTypedData_v4'
    address: Address
    message: string | Hex
    typedData?: unknown
    displayMessage?: string
    riskLevel?: 'low' | 'medium' | 'high'
    riskWarnings?: string[]
  }
  result?: {
    signature: Hex
  }
}

/**
 * Transaction approval (eth_sendTransaction, eth_sendUserOperation)
 */
export interface TransactionApprovalRequest extends BaseApprovalRequest {
  type: 'transaction'
  data: {
    from: Address
    to: Address
    value: bigint
    data?: Hex
    gas?: bigint
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
    // Decoded info
    methodName?: string
    args?: unknown[]
    // Cost estimates
    estimatedGasCost?: bigint
    estimatedTotalCost?: bigint
    // Risk assessment
    riskLevel?: 'low' | 'medium' | 'high'
    warnings?: string[]
    // Token transfers
    tokenTransfers?: TokenTransfer[]
    // Simulation results
    simulation?: {
      success: boolean
      revertReason?: string
      decodedCallData?: {
        functionName: string
        selector: string
        args: Array<{ name: string; type: string; value: string }>
        description: string
      }
      balanceChanges?: Array<{
        asset: string
        symbol: string
        amount: string
        direction: 'in' | 'out'
      }>
    }
  }
  result?: {
    txHash?: Hex
    userOpHash?: Hex
  }
}

export interface TokenTransfer {
  token: Address
  symbol: string
  decimals: number
  amount: bigint
  direction: 'in' | 'out'
}

/**
 * Permission approval (wallet_requestPermissions)
 */
export interface PermissionApprovalRequest extends BaseApprovalRequest {
  type: 'permission'
  data: {
    requestedPermissions: PermissionRequest[]
  }
  result?: {
    grantedPermissions: string[]
  }
}

export interface PermissionRequest {
  parentCapability: string
  caveats?: Caveat[]
}

export interface Caveat {
  type: string
  value: unknown
}

/**
 * Switch network approval (wallet_switchEthereumChain)
 */
export interface SwitchNetworkApprovalRequest extends BaseApprovalRequest {
  type: 'switchNetwork'
  data: {
    chainId: number
    chainName?: string
  }
  result?: {
    switched: boolean
  }
}

/**
 * Add network approval (wallet_addEthereumChain)
 */
export interface AddNetworkApprovalRequest extends BaseApprovalRequest {
  type: 'addNetwork'
  data: {
    chainId: number
    chainName: string
    rpcUrl: string
    nativeCurrency: {
      name: string
      symbol: string
      decimals: number
    }
    blockExplorerUrl?: string
  }
  result?: {
    added: boolean
  }
}

/**
 * Authorization approval (wallet_signAuthorization) - EIP-7702
 */
export interface AuthorizationApprovalRequest extends BaseApprovalRequest {
  type: 'authorization'
  data: {
    /** Account that will be delegated */
    account: Address
    /** Contract to delegate to */
    contractAddress: Address
    /** Chain ID for the authorization */
    chainId: number
    /** Nonce for replay protection */
    nonce: bigint
    /** Whether this is a revocation (delegating to zero address) */
    isRevocation: boolean
    /** Risk level assessment */
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    /** Risk warnings */
    warnings: string[]
    /** Known contract info (if available) */
    contractInfo?: {
      name: string
      description: string
      features: string[]
    }
  }
  result?: {
    /** Signed authorization */
    signedAuthorization: {
      chainId: bigint
      address: Address
      nonce: bigint
      v: number
      r: Hex
      s: Hex
    }
    /** Authorization hash that was signed */
    authorizationHash: Hex
  }
}

/**
 * Union type for all approval requests
 */
export type ApprovalRequest =
  | ConnectApprovalRequest
  | SignatureApprovalRequest
  | TransactionApprovalRequest
  | PermissionApprovalRequest
  | SwitchNetworkApprovalRequest
  | AddNetworkApprovalRequest
  | AuthorizationApprovalRequest

/**
 * Approval controller state
 */
export interface ApprovalControllerState {
  pendingApprovals: ApprovalRequest[]
  approvalHistory: ApprovalRequest[]
}

/**
 * Approval result from popup
 */
export interface ApprovalResult<T = unknown> {
  id: string
  approved: boolean
  data?: T
}
