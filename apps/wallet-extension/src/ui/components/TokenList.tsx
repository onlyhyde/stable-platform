/**
 * TokenList Component
 *
 * Displays a list of token balances (native + ERC-20)
 * with support for adding tokens and managing visibility
 */

import { useState } from 'react'
import { useNetworkCurrency } from '../hooks'
import type { AssetToken } from '../hooks/useAssets'
import type { TokenBalance } from '../hooks/useIndexerData'

interface TokenListProps {
  /** Native coin balance in wei */
  nativeBalance?: bigint
  /** ERC-20 token balances (from indexer) */
  tokenBalances?: TokenBalance[]
  /** Asset tokens (from wallet state) */
  assetTokens?: AssetToken[]
  /** Loading state */
  isLoading: boolean
  /** Refresh callback */
  onRefresh: () => void
  /** Token click callback */
  onTokenClick?: (token: TokenBalance | AssetToken | 'native') => void
  /** Add token callback */
  onAddToken?: () => void
  /** Toggle visibility callback */
  onToggleVisibility?: (address: string) => void
  /** Show hidden tokens */
  showHidden?: boolean
  /** Token prices in USD (keyed by symbol) */
  tokenPrices?: Record<string, number>
  /** Native token price in USD */
  nativePriceUsd?: number | null
}

/**
 * Format balance for display
 */
function formatBalance(balance: string | bigint, decimals = 18): string {
  const value = typeof balance === 'bigint' ? balance : BigInt(balance || '0')
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const remainder = value % divisor

  if (remainder === 0n) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmed = remainderStr.replace(/0+$/, '').slice(0, 4)

  if (trimmed === '') {
    return whole.toString()
  }

  return `${whole}.${trimmed}`
}

/**
 * Merge indexer tokens with asset tokens
 * Prioritizes asset tokens for metadata, indexer tokens for balances
 */
function mergeTokens(
  indexerTokens: TokenBalance[] = [],
  assetTokens: AssetToken[] = []
): (TokenBalance | AssetToken)[] {
  const tokenMap = new Map<string, TokenBalance | AssetToken>()

  // Add asset tokens first (these have visibility info)
  for (const token of assetTokens) {
    tokenMap.set(token.address.toLowerCase(), token)
  }

  // Merge indexer tokens (update balances if available)
  for (const token of indexerTokens) {
    const existing = tokenMap.get(token.address.toLowerCase())
    if (existing) {
      // Update balance from indexer
      tokenMap.set(token.address.toLowerCase(), {
        ...existing,
        balance: token.balance,
        formattedBalance: token.formattedBalance || formatBalance(token.balance, token.decimals),
      })
    } else {
      // Add new token from indexer
      tokenMap.set(token.address.toLowerCase(), {
        ...token,
        isVisible: true,
      } as AssetToken)
    }
  }

  return Array.from(tokenMap.values())
}

export function TokenList({
  nativeBalance,
  tokenBalances = [],
  assetTokens = [],
  isLoading,
  onRefresh,
  onTokenClick,
  onAddToken,
  onToggleVisibility,
  showHidden = false,
  tokenPrices = {},
  nativePriceUsd,
}: TokenListProps) {
  const { symbol: nativeSymbol, name: nativeName } = useNetworkCurrency()
  const [showMenu, setShowMenu] = useState<string | null>(null)

  // Merge tokens from both sources
  const allTokens = mergeTokens(tokenBalances, assetTokens)

  // Filter by visibility
  const visibleTokens = showHidden
    ? allTokens
    : allTokens.filter((t) => !('isVisible' in t) || t.isVisible !== false)

  const handleTokenMenu = (address: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(showMenu === address ? null : address)
  }

  const handleToggleVisibility = (address: string) => {
    onToggleVisibility?.(address)
    setShowMenu(null)
  }

  return (
    <div className="mt-6 flex flex-col flex-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color: 'rgb(var(--foreground-secondary))' }}>
          Assets
        </h3>
        <div className="flex items-center gap-2">
          {/* Add Token Button */}
          {onAddToken && (
            <button
              type="button"
              onClick={onAddToken}
              className="p-1 rounded transition-colors hover:bg-secondary"
              style={{ color: 'rgb(var(--primary))' }}
              title="Add custom token"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          )}
          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 rounded transition-colors hover:bg-secondary"
            style={{ color: 'rgb(var(--muted-foreground))' }}
            title="Refresh balances"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
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
      </div>

      {/* Token List */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        {/* Native Token */}
        <button
          type="button"
          onClick={() => onTokenClick?.('native')}
          className="w-full flex items-center justify-between p-4 transition-colors hover:bg-primary/5"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))',
                color: 'white',
              }}
            >
              {nativeSymbol.charAt(0)}
            </div>
            <div className="text-left">
              <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {nativeSymbol}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {nativeName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {nativeBalance !== undefined ? formatBalance(nativeBalance) : '--'}
            </p>
            {nativePriceUsd != null && nativeBalance !== undefined && (
              <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                ${(Number(formatBalance(nativeBalance)) * nativePriceUsd).toFixed(2)}
              </p>
            )}
          </div>
        </button>

        {/* ERC-20 Tokens */}
        {visibleTokens.length > 0 &&
          visibleTokens.map((token) => {
            const isHidden = 'isVisible' in token && token.isVisible === false

            return (
              <div key={token.address} className="relative">
                <button
                  type="button"
                  onClick={() => onTokenClick?.(token)}
                  className={`w-full flex items-center justify-between p-4 transition-colors hover:bg-primary/5 border-t ${
                    isHidden ? 'opacity-50' : ''
                  }`}
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  <div className="flex items-center gap-3">
                    {/* Token Icon */}
                    {'logoURI' in token && token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          // Fallback to letter icon on error
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
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                          {token.symbol || 'Unknown'}
                        </p>
                        {isHidden && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgb(var(--muted))',
                              color: 'rgb(var(--muted-foreground))',
                            }}
                          >
                            Hidden
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs truncate max-w-[120px]"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {token.name || `${token.address.slice(0, 10)}...`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {token.formattedBalance || formatBalance(token.balance, token.decimals)}
                      </p>
                      {token.symbol && tokenPrices[token.symbol] != null && (
                        <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                          $
                          {(
                            Number(formatBalance(token.balance, token.decimals)) *
                            tokenPrices[token.symbol]!
                          ).toFixed(2)}
                        </p>
                      )}
                    </div>
                    {/* Token Menu Button */}
                    {onToggleVisibility && (
                      <button
                        type="button"
                        onClick={(e) => handleTokenMenu(token.address, e)}
                        className="p-1 rounded transition-colors hover:bg-muted"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          role="img"
                        >
                          <title>More options</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </button>

                {/* Token Context Menu */}
                {showMenu === token.address && (
                  <div
                    className="absolute right-4 top-12 z-10 min-w-[120px] rounded-lg shadow-lg overflow-hidden"
                    style={{
                      backgroundColor: 'rgb(var(--card-hover))',
                      border: '1px solid rgb(var(--border))',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(token.address)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted"
                      style={{ color: 'rgb(var(--foreground))' }}
                    >
                      {isHidden ? (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            role="img"
                          >
                            <title>Show token</title>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          Show
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            role="img"
                          >
                            <title>Hide token</title>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                          Hide
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

        {/* Loading State */}
        {isLoading && visibleTokens.length === 0 && (
          <div
            className="p-4 text-center text-sm border-t"
            style={{
              color: 'rgb(var(--muted-foreground))',
              borderColor: 'rgb(var(--border))',
            }}
          >
            Loading tokens...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && visibleTokens.length === 0 && (
          <div
            className="p-4 text-center border-t"
            style={{
              borderColor: 'rgb(var(--border))',
            }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              No tokens found
            </p>
            {onAddToken && (
              <button
                type="button"
                onClick={onAddToken}
                className="mt-2 text-sm"
                style={{ color: 'rgb(var(--primary))' }}
              >
                + Add custom token
              </button>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(null)}
          onKeyDown={(e) => e.key === 'Escape' && setShowMenu(null)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
