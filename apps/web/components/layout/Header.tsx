'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useWallet, useBalance } from '@/hooks'
import { Button, WalletSelectorModal, NetworkSelector } from '@/components/common'
import { ThemeToggle } from '@/providers'
import { formatAddress, formatTokenAmount } from '@/lib/utils'

export function Header() {
  const { address, isConnected, isConnecting, connect, disconnect, connectors } = useWallet()
  const { balance, symbol, decimals } = useBalance({ address, watch: true })
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [pendingConnector, setPendingConnector] = useState<string>()

  const handleSelectWallet = (connectorId: string) => {
    setPendingConnector(connectorId)
    connect(connectorId)
    setTimeout(() => {
      setShowWalletModal(false)
      setPendingConnector(undefined)
    }, 1500)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-[rgb(var(--card)/0.8)] backdrop-blur-xl"
            style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[rgb(var(--primary))] to-[rgb(var(--primary-hover))] flex items-center justify-center shadow-lg group-hover:shadow-[0_0_20px_-5px_rgb(var(--primary)/0.5)] transition-shadow duration-300">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-xl border-2 border-[rgb(var(--primary))] opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight" style={{ color: 'rgb(var(--foreground))' }}>
              StableNet
            </span>
            <span className="text-2xs font-medium -mt-0.5" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Smart Account Platform
            </span>
          </div>
        </Link>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Network Selector - Shows connected chain and allows switching */}
          <NetworkSelector className="hidden md:flex" />

          {isConnected && address ? (
            <>
              {/* Balance */}
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl"
                   style={{
                     backgroundColor: 'rgb(var(--secondary))',
                     border: '1px solid rgb(var(--border))'
                   }}>
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[rgb(var(--info))] to-[rgb(var(--info-muted))] flex items-center justify-center">
                  <span className="text-2xs font-bold text-white">Ξ</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {formatTokenAmount(balance, decimals)}
                </span>
                <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>{symbol}</span>
              </div>

              {/* Account Button */}
              <button
                type="button"
                onClick={() => disconnect()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 group"
                style={{
                  backgroundColor: 'rgb(var(--secondary))',
                  border: '1px solid rgb(var(--border))'
                }}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[rgb(var(--primary))] via-[rgb(var(--accent))] to-[rgb(var(--info))] ring-2 ring-white dark:ring-[rgb(var(--card))] shadow-sm" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                    {formatAddress(address)}
                  </span>
                  <span className="text-2xs" style={{ color: 'rgb(var(--muted-foreground))' }}>Connected</span>
                </div>
                <svg className="w-4 h-4 ml-1" style={{ color: 'rgb(var(--muted-foreground))' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          ) : (
            <Button
              onClick={() => setShowWalletModal(true)}
              isLoading={isConnecting}
              size="md"
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>

      {/* Wallet Selector Modal */}
      <WalletSelectorModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        connectors={connectors}
        onSelectWallet={handleSelectWallet}
        isConnecting={isConnecting}
        pendingConnector={pendingConnector}
      />
    </header>
  )
}
