'use client'

import { useState, useCallback } from 'react'
import type { Address, Hex } from 'viem'
import { useStableNetContext } from '@/providers'
import type { Announcement, StealthMetaAddress } from '@/types'

interface UseStealthConfig {
  getSpendingPublicKey?: () => Promise<Hex>
  getViewingPublicKey?: () => Promise<Hex>
  signTypedData?: (data: unknown) => Promise<Hex>
  registerOnChain?: (params: { metaAddress: string; signature: Hex }) => Promise<{ transactionHash: Hex }>
  sendTransaction?: (params: { to: Address; value: bigint; data?: Hex }) => Promise<{ hash: Hex }>
}

export function useStealth(config: UseStealthConfig = {}) {
  const { stealthServerUrl } = useStableNetContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [stealthMetaAddress, setStealthMetaAddress] = useState<StealthMetaAddress | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  const {
    getSpendingPublicKey,
    getViewingPublicKey,
    signTypedData,
    registerOnChain,
    sendTransaction,
  } = config

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
      // Each compressed public key is 33 bytes = 66 hex chars
      // Total: 0x + 66 + 66 = 134 chars (or 0x + 64 + 66 for some schemes)
      if (data.length < 132) {
        throw new Error('Invalid stealth meta address length')
      }

      // Parse based on length - support both 64 and 66 char keys
      const keyLength = (data.length - 2) / 2
      const spendingKeyEnd = 2 + keyLength

      return {
        prefix: `${parts[0]}:${parts[1]}`,
        spendingPubKey: `0x${data.slice(2, spendingKeyEnd)}` as Hex,
        viewingPubKey: `0x${data.slice(spendingKeyEnd)}` as Hex,
      }
    } catch {
      return null
    }
  }, [])

  /**
   * Get the stealth meta address URI
   */
  const getStealthMetaAddressURI = useCallback((): string | null => {
    if (!stealthMetaAddress) return null

    const spendingKey = stealthMetaAddress.spendingPubKey.slice(2)
    const viewingKey = stealthMetaAddress.viewingPubKey.slice(2)

    return `${stealthMetaAddress.prefix}:0x${spendingKey}${viewingKey}`
  }, [stealthMetaAddress])

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
      const stealthError = err instanceof Error ? err : new Error('Failed to generate stealth address')
      setError(stealthError)
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
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch announcements')
      setError(fetchError)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [stealthServerUrl])

  /**
   * Register stealth meta address via API
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
      const registerError = err instanceof Error ? err : new Error('Failed to register meta address')
      setError(registerError)
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
    if (!signTypedData || !registerOnChain) {
      setError(new Error('signTypedData and registerOnChain functions required'))
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const metaAddressURI = getStealthMetaAddressURI()
      if (!metaAddressURI) {
        throw new Error('Failed to generate meta address URI')
      }

      // Sign the registration message
      const typedData = {
        domain: {
          name: 'StableNet Stealth Registry',
          version: '1',
        },
        types: {
          Registration: [
            { name: 'metaAddress', type: 'string' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
        primaryType: 'Registration',
        message: {
          metaAddress: metaAddressURI,
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        },
      }

      const signature = await signTypedData(typedData)

      // Register on-chain
      await registerOnChain({
        metaAddress: metaAddressURI,
        signature,
      })

      return true
    } catch (err) {
      const regError = err instanceof Error ? err : new Error('Failed to register stealth meta address')
      setError(regError)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [stealthMetaAddress, signTypedData, registerOnChain, getStealthMetaAddressURI])

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
      if (!getSpendingPublicKey || !getViewingPublicKey) {
        throw new Error('getSpendingPublicKey and getViewingPublicKey functions required')
      }

      const spendingPubKey = await getSpendingPublicKey()
      const viewingPubKey = await getViewingPublicKey()

      const metaAddress: StealthMetaAddress = {
        prefix: 'st:eth',
        spendingPubKey,
        viewingPubKey,
      }

      setStealthMetaAddress(metaAddress)
    } catch (err) {
      const genError = err instanceof Error ? err : new Error('Failed to generate meta address')
      setError(genError)
      setStealthMetaAddress(null)
    } finally {
      setIsLoading(false)
    }
  }, [getSpendingPublicKey, getViewingPublicKey])

  /**
   * Send tokens to a stealth address
   */
  const sendToStealthAddress = useCallback(async (params: {
    stealthAddress: Address
    ephemeralPubKey: Hex
    value: bigint
  }): Promise<{ hash: Hex } | null> => {
    if (!sendTransaction) {
      setError(new Error('sendTransaction function required'))
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const { stealthAddress, ephemeralPubKey, value } = params

      // First, announce the payment on-chain (would call the announcement contract)
      // For now, we just send the transaction directly
      const result = await sendTransaction({
        to: stealthAddress,
        value,
        // In production, this would include data for the announcement contract
      })

      // Register the announcement with the stealth server
      await fetch(`${stealthServerUrl}/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stealthAddress,
          ephemeralPubKey,
          transactionHash: result.hash,
          value: value.toString(),
        }),
      })

      return result
    } catch (err) {
      const sendError = err instanceof Error ? err : new Error('Failed to send to stealth address')
      setError(sendError)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [sendTransaction, stealthServerUrl])

  return {
    stealthMetaAddress,
    announcements,
    parseStealthMetaAddress,
    getStealthMetaAddressURI,
    generateStealthAddress,
    sendToStealthAddress,
    fetchAnnouncements,
    registerMetaAddress,
    registerStealthMetaAddress,
    scanAnnouncements,
    generateOwnMetaAddress,
    isLoading,
    error,
    clearError: () => setError(null),
  }
}
