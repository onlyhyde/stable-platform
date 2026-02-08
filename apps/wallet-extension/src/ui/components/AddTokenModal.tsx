/**
 * AddTokenModal Component
 *
 * Modal for adding custom ERC-20 tokens to the wallet.
 * Supports auto-fetching token metadata from the contract.
 */

import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { useAssets } from '../hooks'
import { Button } from './common/Button'
import { Input } from './common/Input'
import { Modal, ModalFooter } from './common/Modal'
import { Spinner } from './common/Spinner'

interface AddTokenModalProps {
  isOpen: boolean
  onClose: () => void
}

interface TokenPreview {
  address: Address
  symbol: string
  name: string
  decimals: number
}

const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export function AddTokenModal({ isOpen, onClose }: AddTokenModalProps) {
  const { addToken } = useAssets()

  const [tokenAddress, setTokenAddress] = useState('')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [decimals, setDecimals] = useState('')
  const [logoURI, setLogoURI] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenPreview, setTokenPreview] = useState<TokenPreview | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  /**
   * Fetch token metadata from contract
   */
  const fetchTokenMetadata = useCallback(async (address: string) => {
    if (!isValidAddress(address)) {
      setError('Invalid token address')
      return
    }

    setIsFetchingMetadata(true)
    setError(null)
    setTokenPreview(null)

    try {
      // Call background to fetch token metadata
      const _response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `fetch-metadata-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'wallet_getTokenMetadata',
          params: [address],
        },
      })

      // If wallet_getTokenMetadata is not implemented, try direct RPC calls
      // This is a fallback - in production, the RPC handler should support this

      // Fetch symbol
      const symbolResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `symbol-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: address, data: '0x95d89b41' }, 'latest'],
        },
      })

      // Fetch name
      const nameResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `name-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: address, data: '0x06fdde03' }, 'latest'],
        },
      })

      // Fetch decimals
      const decimalsResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `decimals-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: address, data: '0x313ce567' }, 'latest'],
        },
      })

      // Decode responses
      const fetchedSymbol = decodeString(symbolResponse?.payload?.result)
      const fetchedName = decodeString(nameResponse?.payload?.result)
      const fetchedDecimals = decimalsResponse?.payload?.result
        ? Number(BigInt(decimalsResponse.payload.result))
        : 18

      if (!fetchedSymbol && !fetchedName) {
        setError('Could not fetch token metadata. Is this a valid ERC-20 token?')
        return
      }

      setTokenPreview({
        address: address as Address,
        symbol: fetchedSymbol || 'UNKNOWN',
        name: fetchedName || 'Unknown Token',
        decimals: fetchedDecimals,
      })

      // Pre-fill fields
      setSymbol(fetchedSymbol || '')
      setName(fetchedName || '')
      setDecimals(String(fetchedDecimals))
    } catch (_err) {
      setError('Failed to fetch token metadata')
    } finally {
      setIsFetchingMetadata(false)
    }
  }, [])

  /**
   * Handle address input change
   */
  const handleAddressChange = (value: string) => {
    setTokenAddress(value)
    setTokenPreview(null)
    setError(null)

    // Auto-fetch metadata when valid address is entered
    if (isValidAddress(value)) {
      fetchTokenMetadata(value)
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!isValidAddress(tokenAddress)) {
      setError('Invalid token address')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await addToken({
        address: tokenAddress as Address,
        symbol: symbol || undefined,
        name: name || undefined,
        decimals: decimals ? Number(decimals) : undefined,
        logoURI: logoURI || undefined,
      })

      if (result.success) {
        handleClose()
      } else {
        setError(result.error || 'Failed to add token')
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to add token')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Reset form and close modal
   */
  const handleClose = () => {
    setTokenAddress('')
    setSymbol('')
    setName('')
    setDecimals('')
    setLogoURI('')
    setError(null)
    setTokenPreview(null)
    setShowAdvanced(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Token"
      description="Add a custom ERC-20 token to your wallet"
      size="md"
    >
      <div className="space-y-4">
        {/* Token Address */}
        <div>
          <label
            htmlFor="token-address"
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            Token Contract Address
          </label>
          <Input
            id="token-address"
            type="text"
            placeholder="0x..."
            value={tokenAddress}
            onChange={(e) => handleAddressChange(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {/* Loading state */}
        {isFetchingMetadata && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <Spinner size="sm" />
            <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Fetching token information...
            </span>
          </div>
        )}

        {/* Token Preview */}
        {tokenPreview && !isFetchingMetadata && (
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{
                  backgroundColor: 'rgb(var(--muted))',
                  color: 'rgb(var(--foreground))',
                }}
              >
                {tokenPreview.symbol.charAt(0)}
              </div>
              <div>
                <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {tokenPreview.symbol}
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {tokenPreview.name}
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Decimals: {tokenPreview.decimals}
            </div>
          </div>
        )}

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm flex items-center gap-1"
          style={{ color: 'rgb(var(--primary))' }}
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
          >
            <title>Toggle advanced</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced options
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="token-symbol"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'rgb(var(--foreground-secondary))' }}
                >
                  Symbol
                </label>
                <Input
                  id="token-symbol"
                  type="text"
                  placeholder="e.g. USDC"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label
                  htmlFor="token-decimals"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'rgb(var(--foreground-secondary))' }}
                >
                  Decimals
                </label>
                <Input
                  id="token-decimals"
                  type="number"
                  placeholder="18"
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="token-name"
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                Name
              </label>
              <Input
                id="token-name"
                type="text"
                placeholder="e.g. USD Coin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="token-logo"
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                Logo URL (optional)
              </label>
              <Input
                id="token-logo"
                type="url"
                placeholder="https://..."
                value={logoURI}
                onChange={(e) => setLogoURI(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgb(var(--error-muted))',
              color: 'rgb(var(--error))',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={isLoading || !tokenAddress || isFetchingMetadata}
        >
          {isLoading ? 'Adding...' : 'Add Token'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

/**
 * Decode string from ABI-encoded data
 */
function decodeString(data: string | undefined): string {
  if (!data || data === '0x') return ''

  const hex = data.replace('0x', '')

  // Check if it's a dynamic string (starts with offset)
  if (hex.length >= 128) {
    // Dynamic string: offset (32 bytes) + length (32 bytes) + data
    const lengthHex = hex.slice(64, 128)
    const length = Number.parseInt(lengthHex, 16)
    const stringHex = hex.slice(128, 128 + length * 2)
    try {
      const bytes = new Uint8Array(
        stringHex.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []
      )
      return new TextDecoder().decode(bytes).replace(/\0/g, '')
    } catch {
      return ''
    }
  }

  // Static bytes32 string
  try {
    const bytes = new Uint8Array(hex.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? [])
    return new TextDecoder().decode(bytes).replace(/\0/g, '')
  } catch {
    return ''
  }
}
