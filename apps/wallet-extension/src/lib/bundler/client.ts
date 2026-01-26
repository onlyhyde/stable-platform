import type { Address, Hex } from 'viem'
import type {
  PackedUserOperation,
  UserOpGasEstimate,
  UserOperationReceipt,
} from '../userOp'

/**
 * Bundler Client
 * Communicates with ERC-4337 bundler via JSON-RPC
 */

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: unknown[]
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Gas estimation response from bundler
 */
interface GasEstimateResponse {
  preVerificationGas: Hex
  verificationGasLimit: Hex
  callGasLimit: Hex
  paymasterVerificationGasLimit?: Hex
  paymasterPostOpGasLimit?: Hex
}

/**
 * UserOperation by hash response
 */
interface UserOperationByHash {
  userOperation: PackedUserOperation
  entryPoint: Address
  blockNumber: Hex
  blockHash: Hex
  transactionHash: Hex
}

export class BundlerClient {
  private url: string
  private requestId = 0

  constructor(url: string) {
    this.url = url
  }

  /**
   * Send JSON-RPC request to bundler
   */
  private async request<T>(method: string, params: unknown[]): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`Bundler request failed: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as JsonRpcResponse<T>

    if (json.error) {
      const error = new Error(json.error.message) as Error & {
        code: number
        data?: unknown
      }
      error.code = json.error.code
      error.data = json.error.data
      throw error
    }

    return json.result as T
  }

  /**
   * Get supported entry points
   */
  async getSupportedEntryPoints(): Promise<Address[]> {
    return this.request<Address[]>('eth_supportedEntryPoints', [])
  }

  /**
   * Send UserOperation to the bundler
   * @returns userOpHash
   */
  async sendUserOperation(
    userOp: PackedUserOperation,
    entryPoint: Address
  ): Promise<Hex> {
    return this.request<Hex>('eth_sendUserOperation', [userOp, entryPoint])
  }

  /**
   * Estimate gas for a UserOperation
   */
  async estimateUserOperationGas(
    userOp: PackedUserOperation,
    entryPoint: Address
  ): Promise<UserOpGasEstimate> {
    const result = await this.request<GasEstimateResponse>(
      'eth_estimateUserOperationGas',
      [userOp, entryPoint]
    )

    return {
      preVerificationGas: BigInt(result.preVerificationGas),
      verificationGasLimit: BigInt(result.verificationGasLimit),
      callGasLimit: BigInt(result.callGasLimit),
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit
        ? BigInt(result.paymasterVerificationGasLimit)
        : undefined,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit
        ? BigInt(result.paymasterPostOpGasLimit)
        : undefined,
    }
  }

  /**
   * Get UserOperation by hash
   */
  async getUserOperationByHash(
    userOpHash: Hex
  ): Promise<UserOperationByHash | null> {
    return this.request<UserOperationByHash | null>(
      'eth_getUserOperationByHash',
      [userOpHash]
    )
  }

  /**
   * Get UserOperation receipt
   */
  async getUserOperationReceipt(
    userOpHash: Hex
  ): Promise<UserOperationReceipt | null> {
    return this.request<UserOperationReceipt | null>(
      'eth_getUserOperationReceipt',
      [userOpHash]
    )
  }

  /**
   * Wait for UserOperation to be included
   */
  async waitForUserOperation(
    userOpHash: Hex,
    timeout = 60000,
    pollInterval = 2000
  ): Promise<UserOperationReceipt> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getUserOperationReceipt(userOpHash)

      if (receipt) {
        return receipt
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new Error('UserOperation timeout: not included in time')
  }
}

/**
 * Create a bundler client
 */
export function createBundlerClient(url: string): BundlerClient {
  return new BundlerClient(url)
}
