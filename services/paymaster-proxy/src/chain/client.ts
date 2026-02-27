import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

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

/**
 * Create a viem WalletClient for on-chain writes (e.g. auto-deposit).
 * PoC reuses the signer private key; production should use a separate funding key.
 */
export function getWalletClient(rpcUrl: string, privateKey: Hex): WalletClient {
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({
    account,
    transport: http(rpcUrl),
  })
}
