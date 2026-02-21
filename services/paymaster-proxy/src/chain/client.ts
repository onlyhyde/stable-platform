import { createPublicClient, http, type PublicClient } from 'viem'

let cachedClient: PublicClient | null = null
let cachedRpcUrl: string | null = null

/**
 * Get or create a viem PublicClient for on-chain reads
 */
export function getPublicClient(rpcUrl: string): PublicClient {
  if (cachedClient && cachedRpcUrl === rpcUrl) {
    return cachedClient
  }

  cachedClient = createPublicClient({
    transport: http(rpcUrl),
  })
  cachedRpcUrl = rpcUrl

  return cachedClient
}
