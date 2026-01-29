import type { EIP1193Provider, WalletSDKConfig } from '../types'
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
 * @param config - Detection configuration
 * @returns StableNetProvider instance or null if not found
 */
export async function detectProvider(
  config: WalletSDKConfig = {}
): Promise<StableNetProvider | null> {
  const { timeout = 3000 } = config

  // Check if provider is already available
  const existingProvider = getExistingProvider()
  if (existingProvider) {
    return new StableNetProvider(existingProvider)
  }

  // Wait for provider to be injected
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null)
    }, timeout)

    // Listen for EIP-6963 provider announcement
    const handleAnnouncement = (event: Event) => {
      const customEvent = event as CustomEvent<{
        info: { uuid: string; name: string; rdns: string }
        provider: EIP1193Provider
      }>

      if (
        customEvent.detail?.info?.rdns === 'dev.stablenet.wallet' ||
        (customEvent.detail?.provider as { isStableNet?: boolean })?.isStableNet
      ) {
        clearTimeout(timeoutId)
        window.removeEventListener('eip6963:announceProvider', handleAnnouncement)
        resolve(new StableNetProvider(customEvent.detail.provider))
      }
    }

    window.addEventListener('eip6963:announceProvider', handleAnnouncement)

    // Request provider announcements
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  })
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
