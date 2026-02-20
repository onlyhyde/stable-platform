import type { EIP1193Provider } from 'viem'
import type { WalletSDKConfig } from '../types'
import { getProviderRegistry } from './eip6963'
import { StableNetProvider } from './StableNetProvider'

// Extend window type for provider
declare global {
  interface Window {
    stablenet?: EIP1193Provider & { isStableNet?: boolean }
    ethereum?: EIP1193Provider & { isMetaMask?: boolean; isStableNet?: boolean }
  }
}

/**
 * Detect StableNet wallet provider
 *
 * Uses EIP-6963 provider discovery to find the StableNet wallet.
 * Falls back to checking window.stablenet and window.ethereum.
 *
 * @param config - Detection configuration
 * @returns StableNetProvider instance or null if not found
 */
export async function detectProvider(
  config: WalletSDKConfig = {}
): Promise<StableNetProvider | null> {
  const { timeout = 3000 } = config

  // Check if provider is already available synchronously
  const existingProvider = getExistingProvider()
  if (existingProvider) {
    return new StableNetProvider(existingProvider)
  }

  // Use EIP-6963 registry for discovery
  const registry = getProviderRegistry()
  await registry.discover(Math.min(timeout, 500))

  // Check if StableNet was discovered
  const stableNetProvider = registry.getStableNetProvider()
  if (stableNetProvider) {
    return new StableNetProvider(stableNetProvider.provider)
  }

  // If not found yet, wait a bit longer for late announcements
  if (timeout > 500) {
    return new Promise((resolve) => {
      const remainingTimeout = timeout - 500
      const timeoutId = setTimeout(() => {
        unsubscribe()
        resolve(null)
      }, remainingTimeout)

      const unsubscribe = registry.subscribe((event) => {
        if (event.type === 'providerAdded' && event.provider.isStableNet) {
          clearTimeout(timeoutId)
          unsubscribe()
          resolve(new StableNetProvider(event.provider.provider))
        }
      })
    })
  }

  return null
}

/**
 * Get existing provider synchronously
 */
function getExistingProvider(): EIP1193Provider | null {
  // Check for StableNet-specific provider
  if (window.stablenet?.isStableNet) {
    return window.stablenet
  }

  // Check if window.ethereum is StableNet
  if (window.ethereum?.isStableNet) {
    return window.ethereum
  }

  return null
}

/**
 * Get provider synchronously (throws if not available)
 */
export function getProvider(): StableNetProvider {
  const provider = getExistingProvider()
  if (!provider) {
    throw new Error('StableNet wallet not detected')
  }
  return new StableNetProvider(provider)
}

/**
 * Check if StableNet wallet is installed
 */
export function isWalletInstalled(): boolean {
  return getExistingProvider() !== null
}
