import type { Address, Hex } from 'viem'
import type { Mempool } from '../mempool/mempool'
import type { UserOperation } from '@stablenet/types'
import type { BundlerConfig } from '../types'
import { RPC_ERROR_CODES, RpcError } from '../types'
import type { UserOperationValidator } from '../validation'

/**
 * Debug RPC method handlers (ERC-4337 debug_ namespace)
 *
 * These methods are only available when config.debug is true.
 * They bypass security checks and expose internal state.
 */
export class DebugHandlers {
  constructor(
    private mempool: Mempool,
    private validator: UserOperationValidator,
    private config: BundlerConfig,
    private packUserOpForResponse: (userOp: UserOperation) => Record<string, Hex>
  ) {}

  private assertDebugMode(): void {
    if (!this.config.debug) {
      throw new RpcError('Debug methods disabled', RPC_ERROR_CODES.METHOD_NOT_FOUND)
    }
  }

  clearState(): { success: boolean } {
    this.assertDebugMode()
    this.mempool.clear()
    return { success: true }
  }

  dumpMempool(params: unknown[]): unknown[] {
    this.assertDebugMode()
    const [entryPoint] = params as [Address]
    const entries = this.mempool.dump()
    return entries
      .filter((e) => !entryPoint || e.entryPoint.toLowerCase() === entryPoint.toLowerCase())
      .map((e) => ({
        userOp: this.packUserOpForResponse(e.userOp),
        userOpHash: e.userOpHash,
        status: e.status,
      }))
  }

  setReputation(params: unknown[]): { success: boolean } {
    this.assertDebugMode()
    const [entries] = params as [
      Array<{
        address: Address
        opsSeen: number
        opsIncluded: number
        status?: 'ok' | 'throttled' | 'banned'
      }>,
    ]
    const reputationManager = this.validator.getReputationManager()
    for (const entry of entries) {
      reputationManager.setReputation(entry.address, entry.opsSeen, entry.opsIncluded, entry.status)
    }
    return { success: true }
  }

  dumpReputation(params: unknown[]): unknown[] {
    this.assertDebugMode()
    const [_entryPoint] = params as [Address | undefined]
    const reputationManager = this.validator.getReputationManager()
    return reputationManager.dump().map((entry) => ({
      address: entry.address,
      opsSeen: entry.opsSeen,
      opsIncluded: entry.opsIncluded,
      status: entry.status,
    }))
  }

  clearReputation(): { success: boolean } {
    this.assertDebugMode()
    this.validator.clearAllReputation()
    return { success: true }
  }

  getUserOperationStatus(params: unknown[]): { status: string; error?: string } | null {
    this.assertDebugMode()
    const [hash] = params as [Hex]
    const entry = this.mempool.get(hash)
    if (!entry) return null
    return { status: entry.status, error: entry.error }
  }
}
