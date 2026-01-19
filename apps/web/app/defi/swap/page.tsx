'use client'

import { useState } from 'react'
import { useWallet, useSwap } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/common'
import { formatTokenAmount } from '@/lib/utils'
import type { Token } from '@/types'

// Mock tokens for demo
const mockTokens: Token[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
]

export default function SwapPage() {
  const { address, isConnected } = useWallet()
  const { quote, isLoading, error, getQuote, executeSwap } = useSwap()

  const [tokenIn, setTokenIn] = useState<Token>(mockTokens[0])
  const [tokenOut, setTokenOut] = useState<Token>(mockTokens[1])
  const [amountIn, setAmountIn] = useState('')

  function handleSwapTokens() {
    const temp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(temp)
    setAmountIn('')
  }

  async function handleGetQuote() {
    if (!amountIn || Number(amountIn) <= 0) return
    const amountInBigInt = BigInt(Math.floor(Number(amountIn) * 10 ** tokenIn.decimals))
    await getQuote({ tokenIn, tokenOut, amountIn: amountInBigInt })
  }

  async function handleSwap() {
    if (!quote || !address) return
    await executeSwap(quote, address)
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please connect your wallet to swap tokens</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Swap</h1>
        <p className="text-gray-500">Exchange tokens at the best rates</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Swap Tokens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token In */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="amount-in" className="text-sm text-gray-500">You pay</label>
              <span className="text-sm text-gray-500">Balance: 0.00</span>
            </div>
            <div className="flex gap-3">
              <Input
                id="amount-in"
                type="number"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                className="flex-1"
              />
              <select
                value={tokenIn.address}
                onChange={(e) => {
                  const token = mockTokens.find(t => t.address === e.target.value)
                  if (token) setTokenIn(token)
                }}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg font-medium"
                aria-label="Select token to pay"
              >
                {mockTokens.map(token => (
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
              onClick={handleSwapTokens}
              className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
              aria-label="Swap token positions"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* Token Out */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">You receive</span>
              <span className="text-sm text-gray-500">Balance: 0.00</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900">
                {quote ? formatTokenAmount(quote.amountOut, tokenOut.decimals) : '0.0'}
              </div>
              <select
                value={tokenOut.address}
                onChange={(e) => {
                  const token = mockTokens.find(t => t.address === e.target.value)
                  if (token) setTokenOut(token)
                }}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg font-medium"
                aria-label="Select token to receive"
              >
                {mockTokens.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quote Info */}
          {quote && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rate</span>
                <span className="text-gray-900">
                  1 {tokenIn.symbol} = {(Number(quote.amountOut) / Number(quote.amountIn)).toFixed(6)} {tokenOut.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Price Impact</span>
                <span className="text-gray-900">{quote.priceImpact.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Gas Fee</span>
                <span className="text-gray-900">Sponsored</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4">
            {!quote ? (
              <Button
                onClick={handleGetQuote}
                disabled={!amountIn || Number(amountIn) <= 0}
                isLoading={isLoading}
                className="w-full"
              >
                Get Quote
              </Button>
            ) : (
              <Button
                onClick={handleSwap}
                isLoading={isLoading}
                className="w-full"
              >
                Swap
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
