/**
 * WalletConnect v2 types for the wallet extension
 */

/**
 * Persisted WalletConnect session data
 */
export interface WalletConnectSession {
  topic: string
  peerMeta: {
    name: string
    url: string
    description?: string
    icons?: string[]
  }
  namespaces: Record<string, { accounts: string[]; methods: string[]; events: string[] }>
  expiry: number
  connectedAt: number
}

/**
 * WalletConnect session proposal from a dApp
 */
export interface WalletConnectSessionProposal {
  id: number
  params: {
    proposer: {
      publicKey: string
      metadata: {
        name: string
        url: string
        description: string
        icons: string[]
      }
    }
    requiredNamespaces: Record<
      string,
      {
        chains?: string[]
        methods: string[]
        events: string[]
      }
    >
    optionalNamespaces?: Record<
      string,
      {
        chains?: string[]
        methods: string[]
        events: string[]
      }
    >
  }
}

/**
 * WalletConnect JSON-RPC request from a connected dApp
 */
export interface WalletConnectRequest {
  id: number
  topic: string
  params: {
    request: {
      method: string
      params: unknown[]
    }
    chainId: string
  }
}
