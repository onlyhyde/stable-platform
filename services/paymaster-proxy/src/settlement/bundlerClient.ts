import type { Hex } from 'viem'

/**
 * UserOperation receipt from bundler RPC
 */
export interface UserOperationReceipt {
  userOpHash: Hex
  success: boolean
  actualGasCost: bigint
  actualGasUsed: bigint
  /** Revert reason hex if the UserOp execution reverted (from UserOperationRevertReason event) */
  reason?: Hex
  receipt: {
    transactionHash: Hex
    blockNumber: bigint
  }
}

/**
 * Raw JSON-RPC response shape from eth_getUserOperationReceipt
 */
interface RawUserOpReceipt {
  userOpHash: string
  success: boolean
  actualGasCost: string
  actualGasUsed: string
  reason?: string
  receipt: {
    transactionHash: string
    blockNumber: string
  }
}

/**
 * Client for querying bundler RPC for UserOperation receipts.
 * Bundler RPC URL may differ from the chain RPC URL.
 */
export class BundlerClient {
  private readonly rpcUrl: string

  constructor(bundlerRpcUrl: string) {
    this.rpcUrl = bundlerRpcUrl
  }

  /**
   * Query eth_getUserOperationReceipt.
   * Returns null if the operation hasn't been included yet.
   */
  async getUserOperationReceipt(userOpHash: Hex): Promise<UserOperationReceipt | null> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getUserOperationReceipt',
        params: [userOpHash],
      }),
    })

    if (!response.ok) {
      throw new Error(`Bundler RPC error: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as {
      result?: RawUserOpReceipt | null
      error?: { code: number; message: string }
    }

    if (json.error) {
      throw new Error(`Bundler RPC error: ${json.error.message}`)
    }

    if (!json.result) {
      return null
    }

    const raw = json.result
    return {
      userOpHash: raw.userOpHash as Hex,
      success: raw.success,
      actualGasCost: BigInt(raw.actualGasCost),
      actualGasUsed: BigInt(raw.actualGasUsed),
      reason: raw.reason ? (raw.reason as Hex) : undefined,
      receipt: {
        transactionHash: raw.receipt.transactionHash as Hex,
        blockNumber: BigInt(raw.receipt.blockNumber),
      },
    }
  }

  /**
   * Check if the bundler RPC is reachable
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_supportedEntryPoints',
          params: [],
        }),
      })
      return response.ok
    } catch {
      return false
    }
  }
}
