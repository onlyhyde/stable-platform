import type { Address } from 'viem'
import {
  approvalController,
  createRpcError,
  eventBroadcaster,
  getPublicClient,
  RPC_ERRORS,
  type RpcHandler,
  walletState,
} from './shared'

export const networkHandlers: Record<string, RpcHandler> = {
  /**
   * Get current chain ID
   */
  eth_chainId: async () => {
    const network = walletState.getCurrentNetwork()
    return network ? `0x${network.chainId.toString(16)}` : null
  },

  /**
   * Switch to a different chain
   */
  wallet_switchEthereumChain: async (params) => {
    const [{ chainId }] = params as [{ chainId: string }]
    const targetChainId = Number.parseInt(chainId, 16)

    const state = walletState.getState()
    const network = state.networks.networks.find((n) => n.chainId === targetChainId)

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    await walletState.selectNetwork(targetChainId)

    // Broadcast chainChanged event to all connected sites (EIP-1193)
    const chainIdHex = `0x${targetChainId.toString(16)}`
    const connectedOrigins = state.connections.connectedSites.map((s) => s.origin)
    await eventBroadcaster.broadcastChainChanged(chainIdHex, connectedOrigins)

    return null
  },

  /**
   * Add a new Ethereum chain (EIP-3085)
   * Prompts user to approve adding a new network
   */
  wallet_addEthereumChain: async (params, origin) => {
    const [chainParams] = params as [
      {
        chainId: string
        chainName: string
        nativeCurrency: { name: string; symbol: string; decimals: number }
        rpcUrls: string[]
        blockExplorerUrls?: string[]
      },
    ]

    const chainId = Number.parseInt(chainParams.chainId, 16)

    // Check if chain already exists
    const state = walletState.getState()
    const existingNetwork = state.networks.networks.find((n) => n.chainId === chainId)

    if (existingNetwork) {
      // Chain already exists, switch to it
      await walletState.selectNetwork(chainId)
      const chainIdHex = `0x${chainId.toString(16)}`
      const connectedOrigins = state.connections.connectedSites.map((s) => s.origin)
      await eventBroadcaster.broadcastChainChanged(chainIdHex, connectedOrigins)
      return null
    }

    // Validate required rpcUrls
    const rpcUrl = chainParams.rpcUrls[0]
    if (!rpcUrl) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'At least one RPC URL is required',
      })
    }

    // Request user approval
    const result = await approvalController.requestAddNetwork(
      origin,
      chainId,
      chainParams.chainName,
      rpcUrl,
      chainParams.nativeCurrency,
      chainParams.blockExplorerUrls?.[0]
    )

    if (!result.added) {
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }

    // Add network to wallet (bundlerUrl is optional for custom networks)
    await walletState.addNetwork({
      chainId,
      name: chainParams.chainName,
      rpcUrl,
      currency: chainParams.nativeCurrency,
      explorerUrl: chainParams.blockExplorerUrls?.[0],
      isCustom: true,
    })

    return null
  },

  /**
   * Get list of supported networks
   * Custom RPC method for dApps to discover wallet's networks
   */
  wallet_getNetworks: async () => {
    const state = walletState.getState()
    const networks = state.networks.networks

    return networks.map((network) => ({
      chainId: `0x${network.chainId.toString(16)}`,
      chainIdDecimal: network.chainId,
      name: network.name,
      rpcUrl: network.rpcUrl,
      currency: {
        name: network.currency.name,
        symbol: network.currency.symbol,
        decimals: network.currency.decimals,
      },
      explorerUrl: network.explorerUrl,
      isTestnet: network.isTestnet ?? false,
      isCustom: network.isCustom ?? false,
      isSelected: network.chainId === state.networks.selectedChainId,
    }))
  },

  /**
   * Get account balance
   */
  eth_getBalance: async (params) => {
    const [address, _block] = params as [Address, string]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    const balance = await client.getBalance({ address })
    return `0x${balance.toString(16)}`
  },

  /**
   * Get network version (net_version)
   */
  net_version: async () => {
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }
    return network.chainId.toString()
  },
}
