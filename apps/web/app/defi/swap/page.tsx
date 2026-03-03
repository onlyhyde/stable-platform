'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConnectWalletCard, PageHeader, PaymasterSelector, useToast } from '@/components/common'
import { SwapCard } from '@/components/defi'
import type { SupportedToken } from '@/hooks'
import { usePaymaster, useSwap, useUserOp, useWallet } from '@/hooks'
import { useTokens } from '@/hooks/useTokens'
import { formatTokenAmount } from '@/lib/utils'
import type { Token } from '@/types'

export default function SwapPage() {
  const { address, isConnected } = useWallet()
  const { sendUserOp } = useUserOp()
  const { tokens, isLoading: tokensLoading } = useTokens()
  const { quote, isLoading, error, getQuote, executeSwap } = useSwap({
    sendUserOp,
  })
  const {
    selectedType: paymasterType,
    setSelectedType: setPaymasterType,
    selectedTokenAddress: paymasterTokenAddress,
    setSelectedTokenAddress: setPaymasterTokenAddress,
    getSupportedTokens,
    checkSponsorshipEligibility,
    isLoading: paymasterLoading,
    error: paymasterError,
  } = usePaymaster()
  const { addToast, updateToast } = useToast()

  const [tokenIn, setTokenIn] = useState<Token | null>(null)
  const [tokenOut, setTokenOut] = useState<Token | null>(null)
  const [amountIn, setAmountIn] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [gasSponsored, setGasSponsored] = useState<boolean | null>(null)
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[] | null>(null)
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)

  // Initialize default tokens when loaded
  useEffect(() => {
    if (tokens.length >= 2 && !tokenIn && !tokenOut) {
      setTokenIn(tokens[0])
      setTokenOut(tokens[1])
    }
  }, [tokens, tokenIn, tokenOut])

  // Check paymaster sponsorship eligibility
  useEffect(() => {
    if (!address) return
    checkSponsorshipEligibility(address).then((result) => {
      setGasSponsored(result?.eligible ?? null)
    })
  }, [address, checkSponsorshipEligibility])

  // Fetch tokens when erc20/permit2 selected
  useEffect(() => {
    if (paymasterType === 'erc20' || paymasterType === 'permit2') {
      setIsLoadingTokens(true)
      getSupportedTokens()
        .then(setSupportedTokens)
        .finally(() => setIsLoadingTokens(false))
    }
  }, [paymasterType, getSupportedTokens])

  // Compute formatted balances from token data
  const balanceIn = useMemo(() => {
    if (!tokenIn?.balance) return '0'
    return formatTokenAmount(tokenIn.balance, tokenIn.decimals)
  }, [tokenIn])

  const balanceOut = useMemo(() => {
    if (!tokenOut?.balance) return '0'
    return formatTokenAmount(tokenOut.balance, tokenOut.decimals)
  }, [tokenOut])

  // Update tokenIn/tokenOut from the master tokens list when it refreshes
  const handleTokenInChange = useCallback(
    (token: Token) => {
      // Find the token in our list to get fresh balance
      const fresh = tokens.find((t) => t.address === token.address) ?? token
      setTokenIn(fresh)
    },
    [tokens]
  )

  const handleTokenOutChange = useCallback(
    (token: Token) => {
      const fresh = tokens.find((t) => t.address === token.address) ?? token
      setTokenOut(fresh)
    },
    [tokens]
  )

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

      <PaymasterSelector
        selectedType={paymasterType}
        onTypeChange={setPaymasterType}
        supportedTokens={supportedTokens}
        selectedTokenAddress={paymasterTokenAddress}
        onTokenSelect={setPaymasterTokenAddress}
        isLoadingTokens={isLoadingTokens}
        sponsorEligible={gasSponsored}
        isLoading={paymasterLoading}
        error={paymasterError?.message}
      />

      <SwapCard
        tokens={tokens}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        amountIn={amountIn}
        quote={quote}
        isLoading={isLoading}
        error={error}
        balanceIn={balanceIn}
        balanceOut={balanceOut}
        slippage={slippage}
        gasSponsored={gasSponsored}
        onTokenInChange={handleTokenInChange}
        onTokenOutChange={handleTokenOutChange}
        onAmountInChange={setAmountIn}
        onSwapTokens={handleSwapTokens}
        onGetQuote={handleGetQuote}
        onSwap={handleSwap}
        onSlippageChange={setSlippage}
      />
    </div>
  )
}
