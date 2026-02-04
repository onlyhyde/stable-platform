/**
 * useNetworkCurrency Hook
 *
 * Provides the current network's currency information (symbol, name, decimals)
 * based on the selected network. This eliminates hardcoded "ETH" throughout the UI.
 */

import { useMemo } from 'react'
import { useWalletStore } from './useWalletStore'

export interface NetworkCurrency {
  /** Currency symbol (e.g., "ETH", "MATIC", "BNB") */
  symbol: string
  /** Currency name (e.g., "Ethereum", "Polygon", "BNB") */
  name: string
  /** Decimal places (typically 18) */
  decimals: number
}

const DEFAULT_CURRENCY: NetworkCurrency = {
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
}

/**
 * Hook to get the current network's native currency information
 *
 * @returns NetworkCurrency object with symbol, name, and decimals
 *
 * @example
 * ```tsx
 * function BalanceDisplay({ balance }: { balance: bigint }) {
 *   const { symbol, decimals } = useNetworkCurrency()
 *   return <span>{formatUnits(balance, decimals)} {symbol}</span>
 * }
 * ```
 */
export function useNetworkCurrency(): NetworkCurrency {
  const networks = useWalletStore((state) => state.networks)
  const selectedChainId = useWalletStore((state) => state.selectedChainId)

  const currency = useMemo(() => {
    const selectedNetwork = networks.find((n) => n.chainId === selectedChainId)

    if (!selectedNetwork?.currency) {
      return DEFAULT_CURRENCY
    }

    return {
      symbol: selectedNetwork.currency.symbol || DEFAULT_CURRENCY.symbol,
      name: selectedNetwork.currency.name || DEFAULT_CURRENCY.name,
      decimals: selectedNetwork.currency.decimals ?? DEFAULT_CURRENCY.decimals,
    }
  }, [networks, selectedChainId])

  return currency
}

/**
 * Hook to get the current selected network
 *
 * @returns The currently selected Network object or undefined
 */
export function useSelectedNetwork() {
  const networks = useWalletStore((state) => state.networks)
  const selectedChainId = useWalletStore((state) => state.selectedChainId)

  return useMemo(() => {
    return networks.find((n) => n.chainId === selectedChainId)
  }, [networks, selectedChainId])
}
