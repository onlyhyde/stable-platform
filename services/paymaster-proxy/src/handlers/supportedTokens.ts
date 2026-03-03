import type { Address, PublicClient } from 'viem'
import { fetchSupportedTokens } from '../chain/contracts'
import type { SupportedToken } from '../types'

export interface SupportedTokensConfig {
  client: PublicClient
  erc20PaymasterAddress: Address
  oracleAddress?: Address
  supportedChainIds: number[]
}

export type SupportedTokensResult =
  | { success: true; data: SupportedToken[] }
  | { success: false; error: { code: number; message: string; data?: unknown } }

/**
 * Handle pm_supportedTokens request
 *
 * Returns the list of ERC-20 tokens supported by the ERC20Paymaster,
 * along with their exchange rates from the price oracle.
 */
export async function handleSupportedTokens(
  chainId: string,
  config: SupportedTokensConfig
): Promise<SupportedTokensResult> {
  const chainIdNum = Number(chainId)
  if (!config.supportedChainIds.includes(chainIdNum)) {
    return {
      success: false,
      error: {
        code: -32002,
        message: `Chain ${chainIdNum} not supported`,
        data: { supportedChainIds: config.supportedChainIds },
      },
    }
  }

  try {
    const tokens = await fetchSupportedTokens(
      config.client,
      config.erc20PaymasterAddress,
      config.oracleAddress
    )

    return { success: true, data: tokens }
  } catch (error) {
    return {
      success: false,
      error: {
        code: -32603,
        message: `Failed to fetch supported tokens: ${error instanceof Error ? error.message : 'unknown error'}`,
      },
    }
  }
}
