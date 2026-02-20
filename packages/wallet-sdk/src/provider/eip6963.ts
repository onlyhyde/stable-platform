/**
 * EIP-6963: Multi Injected Provider Discovery
 *
 * This module implements the EIP-6963 standard for discovering
 * multiple wallet providers without conflicts.
 *
 * @see https://eips.ethereum.org/EIPS/eip-6963
 */

import { walletSdkLogger } from '../logger'
import type { EIP1193Provider } from 'viem'
import type { EIP6963ProviderDetail, EIP6963ProviderInfo } from '../types'

/**
 * EIP-6963 event types
 */
export const EIP6963_EVENTS = {
  ANNOUNCE: 'eip6963:announceProvider',
  REQUEST: 'eip6963:requestProvider',
} as const

/**
 * Provider registry entry with additional metadata
 */
export interface RegisteredProvider {
  /** Provider info from EIP-6963 announcement */
  info: EIP6963ProviderInfo
  /** The EIP-1193 provider instance */
  provider: EIP1193Provider
  /** Whether this is the StableNet wallet */
  isStableNet: boolean
  /** Timestamp when provider was registered */
  registeredAt: number
}

/**
 * Provider registry event types
 */
export type ProviderRegistryEvent =
  | { type: 'providerAdded'; provider: RegisteredProvider }
  | { type: 'providerRemoved'; uuid: string }
  | { type: 'providersCleared' }

/**
 * Provider registry listener
 */
export type ProviderRegistryListener = (event: ProviderRegistryEvent) => void

/**
 * ProviderRegistry - Manages discovered wallet providers
 *
 * Implements EIP-6963 provider discovery and maintains a registry
 * of all available wallet providers.
 *
 * @example
 * ```typescript
 * const registry = createProviderRegistry()
 *
 * // Listen for new providers
 * registry.subscribe((event) => {
 *   if (event.type === 'providerAdded') {
 *     console.log('New wallet:', event.provider.info.name)
 *   }
 * })
 *
 * // Start discovery
 * await registry.discover()
 *
 * // Get all providers
 * const providers = registry.getProviders()
 *
 * // Get StableNet specifically
 * const stableNet = registry.getStableNetProvider()
 * ```
 */
export class ProviderRegistry {
  private providers: Map<string, RegisteredProvider> = new Map()
  private listeners: Set<ProviderRegistryListener> = new Set()
  private isListening = false
  private announcementHandler: ((event: Event) => void) | null = null

  /**
   * Start listening for provider announcements
   */
  startListening(): void {
    if (this.isListening || typeof window === 'undefined') return

    this.announcementHandler = (event: Event) => {
      const customEvent = event as CustomEvent<EIP6963ProviderDetail>
      if (customEvent.detail?.info && customEvent.detail?.provider) {
        this.registerProvider(customEvent.detail)
      }
    }

    window.addEventListener(EIP6963_EVENTS.ANNOUNCE, this.announcementHandler)
    this.isListening = true
  }

  /**
   * Stop listening for provider announcements
   */
  stopListening(): void {
    if (!this.isListening || !this.announcementHandler) return

    window.removeEventListener(EIP6963_EVENTS.ANNOUNCE, this.announcementHandler)
    this.announcementHandler = null
    this.isListening = false
  }

  /**
   * Discover all available providers
   * Requests announcements and waits for responses
   */
  async discover(timeout = 500): Promise<RegisteredProvider[]> {
    if (typeof window === 'undefined') {
      return []
    }

    // Start listening if not already
    this.startListening()

    // Request provider announcements
    window.dispatchEvent(new Event(EIP6963_EVENTS.REQUEST))

    // Wait for providers to announce themselves
    await new Promise((resolve) => setTimeout(resolve, timeout))

    return this.getProviders()
  }

  /**
   * Register a provider from EIP-6963 announcement
   */
  private registerProvider(detail: EIP6963ProviderDetail): void {
    const { info, provider } = detail

    // Check if this is StableNet
    const isStableNet =
      info.rdns === 'dev.stablenet.wallet' ||
      (provider as { isStableNet?: boolean }).isStableNet === true

    const registered: RegisteredProvider = {
      info,
      provider,
      isStableNet,
      registeredAt: Date.now(),
    }

    const isNew = !this.providers.has(info.uuid)
    this.providers.set(info.uuid, registered)

    if (isNew) {
      this.emit({ type: 'providerAdded', provider: registered })
    }
  }

  /**
   * Get all registered providers
   */
  getProviders(): RegisteredProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Get a specific provider by UUID
   */
  getProvider(uuid: string): RegisteredProvider | undefined {
    return this.providers.get(uuid)
  }

  /**
   * Get StableNet provider if available
   */
  getStableNetProvider(): RegisteredProvider | undefined {
    return this.getProviders().find((p) => p.isStableNet)
  }

  /**
   * Get provider by RDNS (reverse domain name)
   */
  getProviderByRdns(rdns: string): RegisteredProvider | undefined {
    return this.getProviders().find((p) => p.info.rdns === rdns)
  }

  /**
   * Check if any providers are registered
   */
  hasProviders(): boolean {
    return this.providers.size > 0
  }

  /**
   * Get the number of registered providers
   */
  get count(): number {
    return this.providers.size
  }

  /**
   * Subscribe to registry events
   */
  subscribe(listener: ProviderRegistryListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: ProviderRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        walletSdkLogger.error('Error in provider registry listener:', error)
      }
    }
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear()
    this.emit({ type: 'providersCleared' })
  }

  /**
   * Destroy the registry and clean up
   */
  destroy(): void {
    this.stopListening()
    this.clear()
    this.listeners.clear()
  }
}

// Singleton instance for convenience
let defaultRegistry: ProviderRegistry | null = null

/**
 * Create a new provider registry instance
 */
export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry()
}

/**
 * Get the default provider registry (singleton)
 */
export function getProviderRegistry(): ProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ProviderRegistry()
  }
  return defaultRegistry
}

/**
 * Destroy and reset the singleton provider registry.
 * Removes all event listeners, clears providers, and releases the singleton.
 * A new instance will be created on the next `getProviderRegistry()` call.
 */
export function resetProviderRegistry(): void {
  if (defaultRegistry) {
    defaultRegistry.destroy()
    defaultRegistry = null
  }
}

/**
 * Discover all available wallet providers
 *
 * This is a convenience function that uses the default registry.
 *
 * @example
 * ```typescript
 * const providers = await discoverProviders()
 *
 * for (const provider of providers) {
 *   console.log(`${provider.info.name} (${provider.info.rdns})`)
 * }
 * ```
 */
export async function discoverProviders(timeout = 500): Promise<RegisteredProvider[]> {
  const registry = getProviderRegistry()
  return registry.discover(timeout)
}

/**
 * Get all currently known providers
 */
export function getKnownProviders(): RegisteredProvider[] {
  return getProviderRegistry().getProviders()
}
