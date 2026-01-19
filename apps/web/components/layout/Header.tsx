'use client'

import Link from 'next/link'
import { useWallet, useBalance } from '@/hooks'
import { Button } from '@/components/common'
import { formatAddress, formatTokenAmount } from '@/lib/utils'

export function Header() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet()
  const { balance, symbol, decimals } = useBalance({ address, watch: true })

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="font-semibold text-xl text-gray-900">StableNet</span>
        </Link>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {isConnected && address ? (
            <>
              {/* Balance */}
              <div className="hidden sm:block px-3 py-1.5 bg-gray-100 rounded-lg">
                <span className="text-sm font-medium text-gray-700">
                  {formatTokenAmount(balance, decimals)} {symbol}
                </span>
              </div>

              {/* Account */}
              <button
                type="button"
                onClick={() => disconnect()}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600" />
                <span className="text-sm font-medium text-gray-700">
                  {formatAddress(address)}
                </span>
              </button>
            </>
          ) : (
            <Button
              onClick={() => connect()}
              isLoading={isConnecting}
              size="sm"
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
