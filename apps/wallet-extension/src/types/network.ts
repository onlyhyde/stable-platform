/**
 * Network types
 */

export interface Network {
  chainId: number
  name: string
  rpcUrl: string
  bundlerUrl: string
  paymasterUrl?: string
  explorerUrl?: string
  currency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
  isCustom?: boolean
}

export interface NetworkState {
  networks: Network[]
  selectedChainId: number
}
