'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useWalletNetworks, type WalletNetwork } from '@/hooks/useWalletNetworks'

interface NetworkSelectorProps {
  /** Custom class name */
  className?: string
  /** Show full network name or compact version */
  compact?: boolean
}

// Chain icon colors for visual distinction
const CHAIN_COLORS: Record<number, string> = {
  1: 'rgb(var(--info))', // Ethereum Mainnet - blue
  31337: 'rgb(var(--primary))', // Anvil - primary (indigo)
  8283: 'rgb(var(--success))', // StableNet Local - green
  82830: 'rgb(var(--success))', // StableNet Testnet - green
  11155111: 'rgb(var(--warning))', // Sepolia - warning
  137: 'rgb(var(--accent))', // Polygon - purple
  42161: 'rgb(var(--info))', // Arbitrum - blue
  10: 'rgb(var(--error))', // Optimism - red
}

function getChainColor(chainId: number): string {
  return CHAIN_COLORS[chainId] ?? 'rgb(var(--muted-foreground))'
}

/**
 * Network selector dropdown component
 * Shows current network from wagmi and allows switching
 */
export function NetworkSelector({ className = '', compact = false }: NetworkSelectorProps) {
  const { isConnected } = useAccount()
  const { networks, selectedNetwork, isLoading, switchNetwork } = useWalletNetworks()
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNetworkSelect = async (network: WalletNetwork) => {
    if (network.isSelected) {
      setIsOpen(false)
      return
    }

    setIsSwitching(true)
    try {
      const success = await switchNetwork(network.chainIdDecimal)
      if (success) {
        setIsOpen(false)
      }
    } finally {
      setIsSwitching(false)
    }
  }

  // Show "Not Connected" when wallet is not connected
  if (!isConnected || !selectedNetwork) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${className}`}
        style={{
          backgroundColor: 'rgb(var(--muted))',
          border: '1px solid rgb(var(--border))',
        }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: 'rgb(var(--muted-foreground))' }}
        />
        <span className="text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {!isConnected ? 'Not Connected' : 'Unknown Network'}
        </span>
      </div>
    )
  }

  const chainColor = getChainColor(selectedNetwork.chainIdDecimal)

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Selected Network Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || isSwitching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all duration-200 hover:opacity-80"
        style={{
          backgroundColor: selectedNetwork.isTestnet
            ? 'rgb(var(--success-muted))'
            : 'rgb(var(--info-muted))',
          border: `1px solid ${chainColor}33`,
        }}
        title={`Chain ID: ${selectedNetwork.chainIdDecimal}${selectedNetwork.isTestnet ? ' (Testnet)' : ''}`}
      >
        <span
          className={`w-2 h-2 rounded-full ${isSwitching || isLoading ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: chainColor }}
        />
        {!compact && (
          <span className="text-xs font-medium" style={{ color: chainColor }}>
            {selectedNetwork.name}
          </span>
        )}
        {selectedNetwork.isTestnet && (
          <span
            className="text-2xs px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10"
            style={{ color: chainColor }}
          >
            Test
          </span>
        )}
        {networks.length > 1 && (
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: chainColor }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && networks.length > 1 && (
        <div
          className="absolute top-full right-0 mt-2 min-w-[200px] rounded-xl shadow-lg overflow-hidden z-50"
          style={{
            backgroundColor: 'rgb(var(--card))',
            border: '1px solid rgb(var(--border))',
          }}
        >
          <div className="py-1">
            <div
              className="px-3 py-2 text-xs font-semibold"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              Select Network
            </div>
            {networks.map((network) => {
              const color = getChainColor(network.chainIdDecimal)
              return (
                <button
                  key={network.chainId}
                  type="button"
                  onClick={() => handleNetworkSelect(network)}
                  disabled={isSwitching}
                  className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-primary/5"
                  style={{
                    backgroundColor: network.isSelected ? 'rgb(var(--primary) / 0.1)' : undefined,
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'rgb(var(--foreground))' }}
                      >
                        {network.name}
                      </span>
                      {network.isTestnet && (
                        <span
                          className="text-2xs px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: 'rgb(var(--success-muted))',
                            color: 'rgb(var(--success))',
                          }}
                        >
                          Testnet
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      {network.currency.symbol}
                    </span>
                  </div>
                  {network.isSelected && (
                    <svg
                      className="w-4 h-4"
                      style={{ color: 'rgb(var(--primary))' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
