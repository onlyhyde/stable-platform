'use client'

import Image from 'next/image'
import Link from 'next/link'
import { formatEther, formatUnits } from 'viem'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/common'
import type { WalletToken } from '@/hooks'
import { useWallet, useWalletAssets } from '@/hooks'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { formatAddress, formatTokenAmount } from '@/lib/utils'

export default function DashboardPage() {
  const { address, isConnected, connect } = useWallet()
  const { native, tokens, isLoading, isSupported, refetch, addToken: _addToken } = useWalletAssets()
  const { transactions } = useTransactionHistory({ address })
  const recentTxs = transactions.slice(0, 5)

  // For backward compatibility
  const balance = native?.balance ? BigInt(native.balance) : BigInt(0)
  const decimals = native?.decimals ?? 18
  const symbol = native?.symbol ?? 'ETH'

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
        >
          <svg
            className="w-10 h-10"
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
          Welcome to StableNet
        </h1>
        <p className="mb-6 max-w-md" style={{ color: 'rgb(var(--muted-foreground))' }}>
          Connect your wallet to access smart account features, send payments, trade tokens, and
          more.
        </p>
        <Button onClick={() => connect()} size="lg">
          Connect Wallet
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Dashboard
        </h1>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Overview of your StableNet account</p>
      </div>

      {/* Balance Card */}
      <Card className="overflow-hidden">
        <CardContent
          className="py-8 relative"
          style={{
            background:
              'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--primary-hover)), rgb(var(--accent)))',
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-white/80">Total Balance</p>
              <h2 className="text-4xl font-bold text-white mt-2">
                {isLoading ? '...' : formatTokenAmount(balance, decimals)} {symbol}
              </h2>
              <p className="text-sm mt-2 text-white/70">{address && formatAddress(address, 6)}</p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              title="Refresh balance"
            >
              <svg
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Token List (StableNet wallet only) */}
      {isSupported && tokens.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tokens</CardTitle>
            {isSupported && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgb(var(--success) / 0.1)',
                  color: 'rgb(var(--success))',
                }}
              >
                StableNet
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <TokenList tokens={tokens} />
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Send"
          description="Transfer tokens"
          href="/payment/send"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          }
        />
        <QuickActionCard
          title="Receive"
          description="Get paid"
          href="/payment/receive"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          }
        />
        <QuickActionCard
          title="Swap"
          description="Exchange tokens"
          href="/defi/swap"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          }
        />
        <QuickActionCard
          title="Stealth"
          description="Private transfers"
          href="/stealth"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          }
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link
            href="/payment/history"
            className="text-sm font-medium"
            style={{ color: 'rgb(var(--primary))' }}
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {recentTxs.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: 'rgb(var(--muted-foreground) / 0.5)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p style={{ color: 'rgb(var(--muted-foreground))' }}>No recent transactions</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {recentTxs.map((tx) => {
                const isSent = address && tx.from.toLowerCase() === address.toLowerCase()
                return (
                  <div key={tx.hash} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: isSent
                            ? 'rgb(var(--destructive) / 0.1)'
                            : 'rgb(var(--success) / 0.1)',
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          style={{
                            color: isSent ? 'rgb(var(--destructive))' : 'rgb(var(--success))',
                          }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={
                              isSent
                                ? 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
                                : 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                            }
                          />
                        </svg>
                      </div>
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'rgb(var(--foreground))' }}
                        >
                          {isSent ? 'Sent' : 'Received'}
                        </p>
                        <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                          {isSent
                            ? `To ${formatAddress(tx.to, 4)}`
                            : `From ${formatAddress(tx.from, 4)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: isSent ? 'rgb(var(--destructive))' : 'rgb(var(--success))',
                        }}
                      >
                        {isSent ? '-' : '+'}
                        {tx.tokenTransfer
                          ? `${formatUnits(tx.tokenTransfer.value, tx.tokenTransfer.decimals ?? 18)} ${tx.tokenTransfer.symbol ?? formatAddress(tx.tokenTransfer.contractAddress, 3)}`
                          : `${formatEther(tx.value)} ${symbol}`}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface QuickActionCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

function QuickActionCard({ title, description, href, icon }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-all cursor-pointer h-full" hover>
        <CardContent className="flex items-center gap-4 py-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: 'rgb(var(--primary) / 0.1)',
              color: 'rgb(var(--primary))',
            }}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              {title}
            </h3>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/**
 * Token list component
 */
function TokenList({ tokens }: { tokens: WalletToken[] }) {
  if (tokens.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          No tokens found
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
      {tokens.map((token) => (
        <div
          key={token.address}
          className="flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Token Icon */}
            {token.logoURI ? (
              <Image
                src={token.logoURI}
                alt={token.symbol}
                width={32}
                height={32}
                className="rounded-full"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: 'rgb(var(--muted))',
                  color: 'rgb(var(--foreground))',
                }}
              >
                {token.symbol?.charAt(0) || '?'}
              </div>
            )}
            <div>
              <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {token.symbol || 'Unknown'}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {token.name || formatAddress(token.address, 4)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {token.formattedBalance || '0'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
