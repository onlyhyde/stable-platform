'use client'

import { useState, useCallback } from 'react'
import type { Address, Hex } from 'viem'
import { useStableNetContext } from '@/providers'
import type { Announcement, StealthMetaAddress } from '@/types'

export function useStealth() {
  const { stealthServerUrl } = useStableNetContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [stealthMetaAddress, setStealthMetaAddress] = useState<StealthMetaAddress | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  /**
   * Parse stealth meta address URI
   */
  const parseStealthMetaAddress = useCallback((uri: string): StealthMetaAddress | null => {
    try {
      // Format: st:eth:0x<spending_pub_key><viewing_pub_key>
      const parts = uri.split(':')
      if (parts.length !== 3 || parts[0] !== 'st') {
        throw new Error('Invalid stealth meta address format')
      }

      const data = parts[2]
      if (data.length !== 132) { // 0x + 64 + 66 chars
        throw new Error('Invalid stealth meta address length')
      }

      return {
        prefix: `${parts[0]}:${parts[1]}`,
        spendingPubKey: `0x${data.slice(2, 68)}` as Hex,
        viewingPubKey: `0x${data.slice(68)}` as Hex,
      }
    } catch {
      return null
    }
  }, [])

  /**
   * Generate stealth address for recipient
   */
  const generateStealthAddress = useCallback(async (
    recipientMetaAddress: string
  ): Promise<{ stealthAddress: Address; ephemeralPubKey: Hex; viewTag: number } | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const metaAddress = parseStealthMetaAddress(recipientMetaAddress)
      if (!metaAddress) {
        throw new Error('Invalid stealth meta address')
      }

      // In production, this would use the stealth-sdk
      // For now, return a placeholder
      const response = await fetch(`${stealthServerUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaAddress: recipientMetaAddress }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate stealth address')
      }

      const result = await response.json()
      return {
        stealthAddress: result.stealthAddress as Address,
        ephemeralPubKey: result.ephemeralPubKey as Hex,
        viewTag: result.viewTag as number,
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate stealth address')
      setError(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [stealthServerUrl, parseStealthMetaAddress])

  /**
   * Fetch announcements for scanning
   */
  const fetchAnnouncements = useCallback(async (
    fromBlock?: bigint,
    toBlock?: bigint
  ): Promise<Announcement[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (fromBlock) params.set('fromBlock', fromBlock.toString())
      if (toBlock) params.set('toBlock', toBlock.toString())

      const response = await fetch(`${stealthServerUrl}/announcements?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch announcements')
      }

      const result = await response.json()
      return result.announcements as Announcement[]
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch announcements')
      setError(error)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [stealthServerUrl])

  /**
   * Register stealth meta address
   */
  const registerMetaAddress = useCallback(async (
    metaAddress: string,
    signature: Hex
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${stealthServerUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaAddress, signature }),
      })

      if (!response.ok) {
        throw new Error('Failed to register meta address')
      }

      return true
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to register meta address')
      setError(error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [stealthServerUrl])

  /**
   * Register the user's stealth meta address on-chain
   */
  const registerStealthMetaAddress = useCallback(async (): Promise<boolean> => {
    if (!stealthMetaAddress) return false
    // In production, this would sign and register on-chain
    // For now, we'll simulate the registration
    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return true
    } finally {
      setIsLoading(false)
    }
  }, [stealthMetaAddress])

  /**
   * Scan for announcements that belong to this user
   */
  const scanAnnouncements = useCallback(async (): Promise<void> => {
    const results = await fetchAnnouncements()
    setAnnouncements(results)
  }, [fetchAnnouncements])

  /**
   * Generate the user's own stealth meta address
   */
  const generateOwnMetaAddress = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      // In production, this would derive keys from the user's wallet
      // For now, return a mock meta address
      const mockMetaAddress: StealthMetaAddress = {
        prefix: 'st:eth',
        spendingPubKey: `0x${'a'.repeat(64)}` as Hex,
        viewingPubKey: `0x${'b'.repeat(64)}` as Hex,
      }
      setStealthMetaAddress(mockMetaAddress)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate meta address')
      setError(error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    stealthMetaAddress,
    announcements,
    parseStealthMetaAddress,
    generateStealthAddress,
    fetchAnnouncements,
    registerMetaAddress,
    registerStealthMetaAddress,
    scanAnnouncements,
    generateOwnMetaAddress,
    isLoading,
    error,
  }
}
