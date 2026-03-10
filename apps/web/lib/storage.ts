import { getConfigByChainId } from './config'

/**
 * RPC Settings stored in localStorage
 */
export interface RpcSettings {
  rpcUrl: string
  bundlerUrl: string
  paymasterUrl: string
}

const STORAGE_KEY = 'stable-net-rpc-settings'

/** Only allow http(s) URLs to prevent SSRF via localStorage tampering. */
function isValidRpcUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Get saved RPC settings from localStorage
 */
export function getRpcSettings(): RpcSettings | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as RpcSettings
      return {
        rpcUrl: isValidRpcUrl(parsed.rpcUrl) ? parsed.rpcUrl : '',
        bundlerUrl: isValidRpcUrl(parsed.bundlerUrl) ? parsed.bundlerUrl : '',
        paymasterUrl: isValidRpcUrl(parsed.paymasterUrl) ? parsed.paymasterUrl : '',
      }
    }
  } catch {
    // Silently fail - will return null and use defaults
  }

  return null
}

/**
 * Get RPC URL for a specific chain, falling back to default if not set
 */
export function getRpcUrl(_chainId: number, defaultUrl?: string): string | undefined {
  const settings = getRpcSettings()
  if (settings?.rpcUrl) {
    return settings.rpcUrl
  }
  return defaultUrl
}

/**
 * Get Bundler URL, falling back to default if not set
 */
export function getBundlerUrl(defaultUrl?: string): string | undefined {
  const settings = getRpcSettings()
  if (settings?.bundlerUrl) {
    return settings.bundlerUrl
  }
  return defaultUrl
}

/**
 * Get Paymaster URL, falling back to default if not set
 */
export function getPaymasterUrl(defaultUrl?: string): string | undefined {
  const settings = getRpcSettings()
  if (settings?.paymasterUrl) {
    return settings.paymasterUrl
  }
  return defaultUrl
}

/**
 * Block explorer URL options
 */
interface BlockExplorerOptions {
  txHash?: string
  address?: string
}

const FALLBACK_EXPLORER_URL = 'https://explorer.stablenet.dev'

/**
 * Get block explorer URL for a chain, optionally with tx or address path
 */
export function getBlockExplorerUrl(chainId: number, options?: BlockExplorerOptions): string {
  const config = getConfigByChainId(chainId)
  const baseUrl = config?.explorerUrl ?? FALLBACK_EXPLORER_URL

  if (options?.txHash) {
    return `${baseUrl}/tx/${options.txHash}`
  }

  if (options?.address) {
    return `${baseUrl}/address/${options.address}`
  }

  return baseUrl
}
