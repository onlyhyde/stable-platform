'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  Button,
  NetworkSelector,
  NetworkWarningBanner,
  WalletSelectorModal,
} from '@/components/common'
import { useBalance, useWallet } from '@/hooks'
import { copyToClipboard, formatAddress, formatTokenAmount } from '@/lib/utils'
import { ThemeToggle } from '@/providers'

export function Header() {
  const { address, isConnected, isConnecting, connect, disconnect, connectors } = useWallet()
  const { balance, symbol, decimals } = useBalance({ address, watch: true })
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [pendingConnector, setPendingConnector] = useState<string>()
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false)
      }
    }
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAccountMenu])

  const handleCopyAddress = async () => {
    if (!address) return
    const success = await copyToClipboard(address)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSelectWallet = (connectorId: string) => {
    setPendingConnector(connectorId)
    connect(connectorId)
    setTimeout(() => {
      setShowWalletModal(false)
      setPendingConnector(undefined)
    }, 1500)
  }

  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-[rgb(var(--card)/0.8)] backdrop-blur-xl"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo — add left padding on mobile for hamburger button */}
        <Link href="/" className="flex items-center gap-3 group pl-10 md:pl-0">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[rgb(var(--primary))] to-[rgb(var(--primary-hover))] flex items-center justify-center shadow-lg group-hover:shadow-[0_0_20px_-5px_rgb(var(--primary)/0.5)] transition-shadow duration-300">
            <svg className="w-6 h-6" viewBox="0 0 25 28" fill="none" aria-hidden="true">
              <path
                d="M14.019 6.93164V9.49219L24.3228 15.4434V20.7949L12.3169 27.7256L0.311035 20.7949V14.3018L3.71436 16.2676V18.8281L12.3169 23.7969L20.9194 18.8281V17.4062L10.6147 11.458V6.93164H14.019ZM24.3228 6.93164V13.4248L20.9194 11.458V8.89746L12.3169 3.92969L3.71436 8.89746V10.3193L14.019 16.2676V20.7949H10.6147V18.2344L0.311035 12.2822V6.93164L12.3169 0L24.3228 6.93164Z"
                fill="white"
              />
            </svg>
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-xl border-2 border-[rgb(var(--primary))] opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
          </div>
          <div className="flex flex-col">
            <span
              className="font-bold text-xl tracking-tight"
              style={{ color: 'rgb(var(--foreground))' }}
            >
              StableNet
            </span>
            <span
              className="text-2xs font-medium -mt-0.5"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
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
              <div
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  backgroundColor: 'rgb(var(--secondary))',
                  border: '1px solid rgb(var(--border))',
                }}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[rgb(var(--info))] to-[rgb(var(--info-muted))] flex items-center justify-center">
                  <span className="text-2xs font-bold text-white">Ξ</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
                  {formatTokenAmount(balance, decimals)}
                </span>
                <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {symbol}
                </span>
              </div>

              {/* Account Button with Dropdown */}
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowAccountMenu((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 group"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                    border: '1px solid rgb(var(--border))',
                  }}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[rgb(var(--primary))] via-[rgb(var(--accent))] to-[rgb(var(--info))] ring-2 ring-white dark:ring-[rgb(var(--card))] shadow-sm" />
                  <div className="flex flex-col items-start">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'rgb(var(--foreground))' }}
                    >
                      {formatAddress(address)}
                    </span>
                    <span className="text-2xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      Connected
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 ml-1 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`}
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showAccountMenu && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-xl border shadow-lg overflow-hidden z-50"
                    style={{
                      backgroundColor: 'rgb(var(--card))',
                      borderColor: 'rgb(var(--border))',
                    }}
                  >
                    {/* Copy Address */}
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors hover:opacity-80"
                      style={{ color: 'rgb(var(--foreground))' }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      {copied ? 'Copied!' : 'Copy Address'}
                    </button>

                    {/* Settings */}
                    <Link
                      href="/settings"
                      onClick={() => setShowAccountMenu(false)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors hover:opacity-80"
                      style={{ color: 'rgb(var(--foreground))' }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Settings
                    </Link>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid rgb(var(--border))' }} />

                    {/* Disconnect */}
                    <button
                      type="button"
                      onClick={() => {
                        disconnect()
                        setShowAccountMenu(false)
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors hover:opacity-80"
                      style={{ color: 'rgb(var(--destructive))' }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Button
              onClick={() => setShowWalletModal(true)}
              isLoading={isConnecting}
              size="md"
              leftIcon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
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
      <NetworkWarningBanner />
    </header>
  )
}
