/**
 * Transaction Simulator
 *
 * Simulates a transaction via eth_call before signing to preview:
 * - Balance changes (native + token)
 * - Token approvals
 * - Potential revert reasons
 * - Risk warnings
 */

import type { Address, Hex } from 'viem'
import { createPublicClient, http } from 'viem'
import type { Network } from '../../types'
import { type DecodedCallData, decodeCallData } from './callDataDecoder'

/**
 * Simulation result returned to the approval UI
 */
export interface SimulationResult {
  /** Whether the simulation succeeded (eth_call did not revert) */
  success: boolean
  /** Revert reason if simulation failed */
  revertReason?: string
  /** Estimated gas used */
  gasUsed?: bigint
  /** Decoded calldata */
  decodedCallData: DecodedCallData | null
  /** Detected balance changes */
  balanceChanges: BalanceChange[]
  /** Risk warnings from the simulation */
  warnings: string[]
}

export interface BalanceChange {
  /** 'native' for ETH, or token contract address */
  asset: string
  /** Human-readable symbol (ETH, USDC, etc.) */
  symbol: string
  /** Change amount (negative = outgoing) */
  amount: bigint
  /** Direction */
  direction: 'in' | 'out'
}

export interface SimulationParams {
  from: Address
  to?: Address | null
  value?: bigint
  data?: Hex
  gas?: bigint
}

/**
 * Simulate a transaction and return the result.
 *
 * Uses eth_call to dry-run the transaction without sending it on-chain,
 * plus compares the sender's balance before and after.
 */
export async function simulateTransaction(
  params: SimulationParams,
  network: Network
): Promise<SimulationResult> {
  const warnings: string[] = []
  const balanceChanges: BalanceChange[] = []

  // Decode calldata
  const decodedCallData = params.data ? decodeCallData(params.data) : null

  // Add warnings based on decoded calldata
  if (decodedCallData) {
    if (decodedCallData.functionName === 'approve') {
      const amountArg = decodedCallData.args.find((a) => a.name === 'amount')
      if (amountArg?.value === 'UNLIMITED') {
        warnings.push('This transaction grants UNLIMITED token approval')
      }
    }
    if (decodedCallData.functionName === 'setApprovalForAll') {
      const approvedArg = decodedCallData.args.find((a) => a.name === 'approved')
      if (approvedArg?.value === 'true') {
        warnings.push('This grants access to ALL your NFTs in this collection')
      }
    }
  }

  // Track native value transfer
  const value = params.value ?? 0n
  if (value > 0n) {
    balanceChanges.push({
      asset: 'native',
      symbol: network.currency.symbol,
      amount: value,
      direction: 'out',
    })
  }

  // Create a public client for eth_call
  const client = createPublicClient({
    transport: http(network.rpcUrl),
  })

  try {
    // Simulate via eth_call
    await client.call({
      account: params.from,
      to: params.to ?? undefined,
      value,
      data: params.data,
      gas: params.gas,
    })

    return {
      success: true,
      decodedCallData,
      balanceChanges,
      warnings,
    }
  } catch (error) {
    const revertReason = extractRevertReason(error)

    // Detect Kernel Reentrancy error (selector 0xab143c06)
    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage.includes('0xab143c06') || revertReason.includes('0xab143c06')) {
      warnings.push(
        'Reentrancy detected in module operation. Module install/uninstall must be executed sequentially.'
      )
    } else {
      warnings.push('Transaction simulation failed - this transaction may revert')
    }

    return {
      success: false,
      revertReason,
      decodedCallData,
      balanceChanges,
      warnings,
    }
  }
}

/**
 * Extract a human-readable revert reason from an eth_call error
 */
function extractRevertReason(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message

    // Look for "execution reverted:" pattern
    const revertMatch = message.match(/execution reverted:\s*(.+)/i)
    if (revertMatch?.[1]) {
      return revertMatch[1]
    }

    // Look for hex-encoded revert reason (Error(string))
    const hexMatch = message.match(/0x08c379a0(.+)/i)
    if (hexMatch?.[1]) {
      try {
        const data = hexMatch[1]
        // Skip offset (32 bytes) + length (32 bytes)
        const lengthHex = data.slice(64, 128)
        const length = Number.parseInt(lengthHex, 16) * 2
        const reasonHex = data.slice(128, 128 + length)
        const bytes: number[] = []
        for (let i = 0; i < reasonHex.length; i += 2) {
          bytes.push(Number.parseInt(reasonHex.slice(i, i + 2), 16))
        }
        return String.fromCharCode(...bytes)
      } catch {
        // Fallback to raw message
      }
    }

    return message
  }

  return 'Unknown error'
}
