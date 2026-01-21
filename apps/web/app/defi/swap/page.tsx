'use client'

import { useState } from 'react'
import { useWallet, useSwap } from '@/hooks'
import { PageHeader, ConnectWalletCard } from '@/components/common'
import { SwapCard } from '@/components/defi'
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
      <ConnectWalletCard message="Please connect your wallet to swap tokens" />
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <PageHeader
        title="Swap"
        description="Exchange tokens at the best rates"
      />

      <SwapCard
        tokens={mockTokens}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        amountIn={amountIn}
        quote={quote}
        isLoading={isLoading}
        error={error}
        onTokenInChange={setTokenIn}
        onTokenOutChange={setTokenOut}
        onAmountInChange={setAmountIn}
        onSwapTokens={handleSwapTokens}
        onGetQuote={handleGetQuote}
        onSwap={handleSwap}
      />
    </div>
  )
}
