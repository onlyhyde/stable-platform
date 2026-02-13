'use client'

import { useEffect, useState } from 'react'
import { ConnectWalletCard, PageHeader, useToast } from '@/components/common'
import { SwapCard } from '@/components/defi'
import { useSwap, useUserOp, useWallet } from '@/hooks'
import { useTokens } from '@/hooks/useTokens'
import type { Token } from '@/types'

export default function SwapPage() {
  const { address, isConnected } = useWallet()
  const { sendUserOp } = useUserOp()
  const { tokens, isLoading: tokensLoading } = useTokens()
  const { quote, isLoading, error, getQuote, executeSwap } = useSwap({
    sendUserOp,
  })
  const { addToast, updateToast } = useToast()

  const [tokenIn, setTokenIn] = useState<Token | null>(null)
  const [tokenOut, setTokenOut] = useState<Token | null>(null)
  const [amountIn, setAmountIn] = useState('')
  const [slippage, setSlippage] = useState(0.5)

  // Initialize default tokens when loaded
  useEffect(() => {
    if (tokens.length >= 2 && !tokenIn && !tokenOut) {
      setTokenIn(tokens[0])
      setTokenOut(tokens[1])
    }
  }, [tokens, tokenIn, tokenOut])

  function handleSwapTokens() {
    if (!tokenIn || !tokenOut) return
    const temp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(temp)
    setAmountIn('')
  }

  async function handleGetQuote() {
    if (!amountIn || Number(amountIn) <= 0 || !tokenIn || !tokenOut) return
    const amountInBigInt = BigInt(Math.floor(Number(amountIn) * 10 ** tokenIn.decimals))
    await getQuote({ tokenIn, tokenOut, amountIn: amountInBigInt })
  }

  async function handleSwap() {
    if (!quote || !address || !tokenIn || !tokenOut) return
    const toastId = addToast({
      type: 'loading',
      title: 'Swapping Tokens',
      message: `Swapping ${amountIn} ${tokenIn.symbol} for ${tokenOut.symbol}...`,
      persistent: true,
    })
    try {
      await executeSwap(quote, address)
      updateToast(toastId, {
        type: 'success',
        title: 'Swap Complete',
        message: `Swapped ${amountIn} ${tokenIn.symbol} for ${tokenOut.symbol}`,
        persistent: false,
      })
    } catch {
      updateToast(toastId, {
        type: 'error',
        title: 'Swap Failed',
        message: error?.message ?? 'Swap transaction failed',
        persistent: false,
      })
    }
  }

  if (!isConnected) {
    return <ConnectWalletCard message="Please connect your wallet to swap tokens" />
  }

  if (tokensLoading || !tokenIn || !tokenOut) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading tokens...</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <PageHeader title="Swap" description="Exchange tokens at the best rates" />

      <SwapCard
        tokens={tokens}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        amountIn={amountIn}
        quote={quote}
        isLoading={isLoading}
        error={error}
        slippage={slippage}
        onTokenInChange={setTokenIn}
        onTokenOutChange={setTokenOut}
        onAmountInChange={setAmountIn}
        onSwapTokens={handleSwapTokens}
        onGetQuote={handleGetQuote}
        onSwap={handleSwap}
        onSlippageChange={setSlippage}
      />
    </div>
  )
}
