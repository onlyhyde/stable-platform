'use client'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/common'
import { formatTokenAmount } from '@/lib/utils'
import type { SwapQuote, Token } from '@/types'

interface SwapCardProps {
  tokens: Token[]
  tokenIn: Token
  tokenOut: Token
  amountIn: string
  quote: SwapQuote | null
  isLoading: boolean
  error: Error | null
  balanceIn?: string
  balanceOut?: string
  slippage?: number
  gasSponsored?: boolean | null
  onTokenInChange: (token: Token) => void
  onTokenOutChange: (token: Token) => void
  onAmountInChange: (amount: string) => void
  onSwapTokens: () => void
  onGetQuote: () => void
  onSwap: () => void
  onSlippageChange?: (slippage: number) => void
}

export function SwapCard({
  tokens,
  tokenIn,
  tokenOut,
  amountIn,
  quote,
  isLoading,
  error,
  onTokenInChange,
  onTokenOutChange,
  onAmountInChange,
  onSwapTokens,
  balanceIn = '0',
  balanceOut = '0',
  slippage = 0.5,
  gasSponsored,
  onGetQuote,
  onSwap,
  onSlippageChange,
}: SwapCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Swap Tokens</CardTitle>
        {/* Slippage Settings */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Slippage
          </span>
          <div className="flex items-center gap-1">
            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onSlippageChange?.(val)}
                className="px-2 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    slippage === val ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
                  color: slippage === val ? 'white' : 'rgb(var(--foreground))',
                }}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token In */}
        <div
          className="p-4 rounded-lg space-y-2"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <div className="flex justify-between items-center">
            <label
              htmlFor="amount-in"
              className="text-sm"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              You pay
            </label>
            <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Balance: {balanceIn}
            </span>
          </div>
          <div className="flex gap-3">
            <Input
              id="amount-in"
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => onAmountInChange(e.target.value)}
              className="flex-1"
            />
            <select
              value={tokenIn.address}
              onChange={(e) => {
                const token = tokens.find((t) => t.address === e.target.value)
                if (token) onTokenInChange(token)
              }}
              className="px-4 py-2 border rounded-lg font-medium"
              style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))' }}
              aria-label="Select token to pay"
            >
              {tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2">
          <button
            type="button"
            onClick={onSwapTokens}
            className="p-2 border rounded-full hover:opacity-80 transition-colors"
            style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))' }}
            aria-label="Swap token positions"
          >
            <svg
              className="w-5 h-5"
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
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        {/* Token Out */}
        <div
          className="p-4 rounded-lg space-y-2"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              You receive
            </span>
            <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Balance: {balanceOut}
            </span>
          </div>
          <div className="flex gap-3">
            <div
              className="flex-1 px-4 py-2 border rounded-lg"
              style={{
                borderColor: 'rgb(var(--border))',
                color: 'rgb(var(--foreground))',
                backgroundColor: 'rgb(var(--card))',
              }}
            >
              {quote ? formatTokenAmount(quote.amountOut, tokenOut.decimals) : '0.0'}
            </div>
            <select
              value={tokenOut.address}
              onChange={(e) => {
                const token = tokens.find((t) => t.address === e.target.value)
                if (token) onTokenOutChange(token)
              }}
              className="px-4 py-2 border rounded-lg font-medium"
              style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))' }}
              aria-label="Select token to receive"
            >
              {tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quote Info */}
        {quote && (
          <div
            className="p-3 rounded-lg space-y-2"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Rate</span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                1 {tokenIn.symbol} = {(Number(quote.amountOut) / Number(quote.amountIn)).toFixed(6)}{' '}
                {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Price Impact</span>
              <span style={{ color: 'rgb(var(--foreground))' }}>
                {quote.priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Slippage Tolerance</span>
              <span style={{ color: 'rgb(var(--foreground))' }}>{slippage}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--muted-foreground))' }}>Gas Fee</span>
              <span
                style={{ color: gasSponsored ? 'rgb(var(--success))' : 'rgb(var(--foreground))' }}
              >
                {gasSponsored === null
                  ? 'Checking...'
                  : gasSponsored
                    ? 'Sponsored'
                    : 'User pays gas'}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="p-3 rounded-lg border"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              borderColor: 'rgb(var(--destructive) / 0.3)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-4">
          {!quote ? (
            <Button
              onClick={onGetQuote}
              disabled={!amountIn || Number(amountIn) <= 0}
              isLoading={isLoading}
              className="w-full"
            >
              Get Quote
            </Button>
          ) : (
            <Button onClick={onSwap} isLoading={isLoading} className="w-full">
              Swap
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
