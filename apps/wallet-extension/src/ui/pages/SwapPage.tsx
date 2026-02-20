import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEther } from 'viem'
import { useAssets, useSelectedNetwork } from '../hooks'
import { useNetworkCurrency } from '../hooks/useNetworkCurrency'
import { useTokenPrices } from '../hooks/useTokenPrices'
import { useWalletStore } from '../hooks/useWalletStore'

// Native token placeholder address (zero address signals native token)
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const DEFAULT_SWAP_FEE = 3000 // Uniswap V3 0.3% fee tier
const DEFAULT_DEADLINE_MINUTES = 20

interface SwapFormState {
  fromToken: string // symbol
  toToken: string // symbol
  fromAmount: string
  slippage: number // percentage (0.5, 1, 2)
}

interface SwapEstimate {
  estimatedOutput: string
  priceImpact: number | null
  minOutput: string
}

/**
 * Token Swap Page
 *
 * Provides a DEX-style swap interface using installed Swap Executor module.
 * Encodes actual swap calldata via stablenet_executeSwap RPC.
 */
export function SwapPage() {
  const { t } = useTranslation('swap')
  const { selectedAccount, accounts, balances, setPage } = useWalletStore()
  const { tokens: assetTokens } = useAssets()
  const currentNetwork = useSelectedNetwork()
  const { symbol: nativeSymbol } = useNetworkCurrency()
  const currentAccount = accounts.find((a) => a.address === selectedAccount)
  const balance = selectedAccount ? balances[selectedAccount] : undefined

  const [form, setForm] = useState<SwapFormState>({
    fromToken: '',
    toToken: '',
    fromAmount: '',
    slippage: 0.5,
  })
  const [isSwapping, setIsSwapping] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [swapResult, setSwapResult] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<SwapEstimate | null>(null)
  const [swapExecutorAddress, setSwapExecutorAddress] = useState<string | null>(null)

  // Initialize fromToken with native symbol
  useEffect(() => {
    if (nativeSymbol && !form.fromToken) {
      setForm((prev) => ({ ...prev, fromToken: nativeSymbol }))
    }
  }, [nativeSymbol, form.fromToken])

  // Collect symbols for price lookup
  const allSymbols = [nativeSymbol, ...assetTokens.map((t) => t.symbol).filter(Boolean)]
  const uniqueSymbols = [...new Set(allSymbols)]
  const { prices: tokenPrices } = useTokenPrices(uniqueSymbols)

  const slippageOptions = [0.5, 1, 2]

  // Find swap executor module from installed modules
  useEffect(() => {
    async function findSwapExecutor() {
      if (!selectedAccount || !currentNetwork) return

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'RPC_REQUEST',
          id: `find-swap-${Date.now()}`,
          payload: {
            jsonrpc: '2.0',
            id: 1,
            method: 'stablenet_getInstalledModules',
            params: [{ account: selectedAccount, chainId: currentNetwork.chainId }],
          },
        })

        const modules = response?.payload?.result?.modules ?? []
        // Executor module type = 2
        const swapModule = modules.find(
          (m: { type: number | bigint; metadata?: { name?: string } }) =>
            Number(m.type) === 2 && m.metadata?.name?.toLowerCase().includes('swap')
        )
        if (swapModule) {
          setSwapExecutorAddress(swapModule.address)
        }
      } catch {
        // Module lookup failed - swap executor not found
      }
    }

    findSwapExecutor()
  }, [selectedAccount, currentNetwork])

  // Estimate swap output based on token prices
  const updateEstimate = useCallback(() => {
    if (!form.fromAmount || !form.toToken || !form.fromToken) {
      setEstimate(null)
      return
    }

    const fromPrice = tokenPrices[form.fromToken] ?? 0
    const toPrice = tokenPrices[form.toToken] ?? 0

    if (fromPrice === 0 || toPrice === 0) {
      setEstimate(null)
      return
    }

    const fromValue = Number(form.fromAmount) * fromPrice
    const estimatedOutputNum = fromValue / toPrice
    const slippageBps = form.slippage * 100 // convert % to bps
    const minOutputNum = estimatedOutputNum * (1 - slippageBps / 10000)

    // Estimate price impact: swap fee (0.3%) + size-based impact approximation
    // For small trades impact ≈ fee; larger trades have proportionally higher impact
    const swapFeePercent = DEFAULT_SWAP_FEE / 10000 // 0.3%
    const toValue = estimatedOutputNum * toPrice
    const executionSlip = fromValue > 0 ? Math.abs(fromValue - toValue) / fromValue : 0
    const priceImpact = Math.max(swapFeePercent, executionSlip) * 100 // as percentage

    setEstimate({
      estimatedOutput: estimatedOutputNum.toFixed(6),
      priceImpact: Math.round(priceImpact * 100) / 100,
      minOutput: minOutputNum.toFixed(6),
    })
  }, [form.fromAmount, form.fromToken, form.toToken, form.slippage, tokenPrices])

  useEffect(() => {
    updateEstimate()
  }, [updateEstimate])

  // Check if a symbol is the native token
  function isNativeToken(symbol: string): boolean {
    return symbol === nativeSymbol
  }

  // Resolve token symbol to address
  function getTokenAddress(symbol: string): string {
    if (isNativeToken(symbol)) return NATIVE_TOKEN_ADDRESS
    const token = assetTokens.find((t) => t.symbol === symbol)
    return token?.address ?? NATIVE_TOKEN_ADDRESS
  }

  // Get token decimals
  function getTokenDecimals(symbol: string): number {
    if (isNativeToken(symbol)) return currentNetwork?.currency.decimals ?? 18
    const token = assetTokens.find((t) => t.symbol === symbol)
    return token?.decimals ?? 18
  }

  // Get display balance for selected from token
  function getFromBalance(): string | null {
    if (isNativeToken(form.fromToken) && balance !== undefined) {
      return Number(formatEther(balance)).toFixed(4)
    }
    const token = assetTokens.find((t) => t.symbol === form.fromToken)
    if (token?.formattedBalance) return token.formattedBalance
    return null
  }

  function handleSwapTokens() {
    setForm((prev) => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
    }))
    setEstimate(null)
  }

  function handleSetMaxAmount() {
    if (isNativeToken(form.fromToken) && balance !== undefined) {
      // Leave some gas for the swap tx
      const maxNative = Number(formatEther(balance))
      const reserveForGas = 0.01
      const maxAmount = Math.max(0, maxNative - reserveForGas)
      setForm((prev) => ({ ...prev, fromAmount: maxAmount.toString() }))
    } else {
      const token = assetTokens.find((t) => t.symbol === form.fromToken)
      if (token?.formattedBalance) {
        setForm((prev) => ({ ...prev, fromAmount: token.formattedBalance! }))
      }
    }
  }

  async function handleSwap() {
    if (!form.fromAmount || !form.toToken || !selectedAccount || !currentNetwork) return

    if (!swapExecutorAddress) {
      setSwapError(t('swapModuleNotInstalledDesc'))
      return
    }

    setIsSwapping(true)
    setSwapError(null)
    setSwapResult(null)

    try {
      const fromDecimals = getTokenDecimals(form.fromToken)
      const toDecimals = getTokenDecimals(form.toToken)
      const tokenInAddress = getTokenAddress(form.fromToken)
      const tokenOutAddress = getTokenAddress(form.toToken)

      // Parse amounts to wei
      const amountInWei = parseAmountToWei(form.fromAmount, fromDecimals)
      const minAmountOutWei = estimate ? parseAmountToWei(estimate.minOutput, toDecimals) : 0n

      // Deadline: current time + N minutes
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_MINUTES * 60

      const response = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `swap-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'stablenet_executeSwap',
          params: [
            {
              account: selectedAccount,
              swapExecutorAddress,
              tokenIn: tokenInAddress,
              tokenOut: tokenOutAddress,
              fee: DEFAULT_SWAP_FEE,
              amountIn: amountInWei.toString(),
              amountOutMinimum: minAmountOutWei.toString(),
              deadline: deadlineTimestamp.toString(),
              chainId: currentNetwork.chainId,
            },
          ],
        },
      })

      if (response?.payload?.error) {
        throw new Error(response.payload.error.message || t('swapFailed'))
      }

      const hash = response?.payload?.result?.hash
      setSwapResult(hash ?? t('swapSubmitted'))
      // Reset form after success
      setForm((prev) => ({ ...prev, fromAmount: '' }))
      setEstimate(null)
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : t('swapFailed'))
    } finally {
      setIsSwapping(false)
    }
  }

  const fromBalance = getFromBalance()
  const isSmartAccount = currentAccount?.type === 'smart'
  const canSwap =
    isSmartAccount && !!swapExecutorAddress && !!form.fromAmount && !!form.toToken && !isSwapping

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPage('home')}
          className="p-1 rounded-lg"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
          {t('title')}
        </h1>
      </div>

      {/* From Token */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('from')}
          </span>
          {fromBalance !== null && (
            <button
              type="button"
              onClick={handleSetMaxAmount}
              className="text-xs"
              style={{ color: 'rgb(var(--primary))' }}
            >
              {t('maxBalance', { balance: fromBalance })}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="decimal"
            value={form.fromAmount}
            onChange={(e) => setForm((prev) => ({ ...prev, fromAmount: e.target.value }))}
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-semibold outline-none"
            style={{ color: 'rgb(var(--foreground))' }}
          />
          <select
            value={form.fromToken}
            onChange={(e) => setForm((prev) => ({ ...prev, fromToken: e.target.value }))}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              border: '1px solid rgb(var(--border))',
            }}
          >
            <option value={nativeSymbol}>{nativeSymbol}</option>
            {assetTokens.map((t) => (
              <option key={t.address} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
        {form.fromAmount && tokenPrices[form.fromToken] != null && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            ~${(Number(form.fromAmount) * (tokenPrices[form.fromToken] ?? 0)).toFixed(2)}
          </p>
        )}
      </div>

      {/* Swap Direction Button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          type="button"
          onClick={handleSwapTokens}
          className="w-10 h-10 rounded-full flex items-center justify-center border-4"
          style={{
            backgroundColor: 'rgb(var(--background))',
            borderColor: 'rgb(var(--secondary))',
            color: 'rgb(var(--primary))',
          }}
        >
          <svg
            className="w-5 h-5"
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

      {/* To Token */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('toEstimated')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            readOnly
            value={estimate?.estimatedOutput ?? ''}
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-semibold outline-none"
            style={{ color: 'rgb(var(--foreground))' }}
          />
          <select
            value={form.toToken}
            onChange={(e) => setForm((prev) => ({ ...prev, toToken: e.target.value }))}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              border: '1px solid rgb(var(--border))',
            }}
          >
            <option value="">{t('selectToken')}</option>
            {assetTokens
              .filter((t) => t.symbol !== form.fromToken)
              .map((t) => (
                <option key={t.address} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
          </select>
        </div>
        {estimate && tokenPrices[form.toToken] != null && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            ~${(Number(estimate.estimatedOutput) * (tokenPrices[form.toToken] ?? 0)).toFixed(2)}
          </p>
        )}
      </div>

      {/* Swap Details */}
      {estimate && form.fromAmount && form.toToken && (
        <div
          className="rounded-xl p-3 space-y-2 text-xs"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <div className="flex justify-between" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <span>{t('rate')}</span>
            <span>
              1 {form.fromToken} ={' '}
              {(Number(estimate.estimatedOutput) / Number(form.fromAmount)).toFixed(6)}{' '}
              {form.toToken}
            </span>
          </div>
          <div className="flex justify-between" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <span>{t('minReceived')}</span>
            <span>
              {estimate.minOutput} {form.toToken}
            </span>
          </div>
          <div className="flex justify-between" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <span>{t('slippageTolerance')}</span>
            <span>{form.slippage}%</span>
          </div>
          {estimate.priceImpact != null && (
            <div
              className="flex justify-between"
              style={{
                color:
                  estimate.priceImpact > 5
                    ? 'rgb(var(--destructive))'
                    : estimate.priceImpact > 2
                      ? 'rgb(var(--warning, 234 179 8))'
                      : 'rgb(var(--muted-foreground))',
              }}
            >
              <span>{t('priceImpact', 'Price Impact')}</span>
              <span>{estimate.priceImpact}%</span>
            </div>
          )}
          <div className="flex justify-between" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <span>{t('feeTier')}</span>
            <span>{DEFAULT_SWAP_FEE / 10000}%</span>
          </div>
        </div>
      )}

      {/* Slippage Tolerance */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('slippageToleranceTitle')}
        </p>
        <div className="flex gap-2">
          {slippageOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, slippage: s }))}
              className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor:
                  form.slippage === s ? 'rgb(var(--primary))' : 'rgb(var(--background))',
                color: form.slippage === s ? 'white' : 'rgb(var(--foreground))',
              }}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {swapError && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            color: 'rgb(var(--destructive))',
          }}
        >
          {swapError}
        </div>
      )}

      {/* Success Display */}
      {swapResult && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{
            backgroundColor: 'rgb(var(--success) / 0.1)',
            color: 'rgb(var(--success))',
          }}
        >
          <p className="font-medium">{t('swapSubmitted')}</p>
          {swapResult.startsWith('0x') && (
            <p className="text-xs mt-1 font-mono break-all">{swapResult}</p>
          )}
        </div>
      )}

      {/* Swap Button */}
      <button
        type="button"
        onClick={handleSwap}
        disabled={!canSwap}
        className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
        style={{
          backgroundColor: 'rgb(var(--primary))',
          color: 'white',
        }}
      >
        {isSwapping
          ? t('swapping')
          : !isSmartAccount
            ? t('smartAccountRequired')
            : !swapExecutorAddress
              ? t('swapModuleNotInstalled')
              : !form.toToken
                ? t('selectToken')
                : !form.fromAmount
                  ? t('enterAmount')
                  : t('swapBtn')}
      </button>

      {!isSmartAccount && (
        <p className="text-xs text-center" style={{ color: 'rgb(var(--warning))' }}>
          {t('swapRequiresSmartAccount')}
        </p>
      )}

      {isSmartAccount && !swapExecutorAddress && (
        <button
          type="button"
          onClick={() => setPage('modules')}
          className="w-full text-xs text-center py-2"
          style={{ color: 'rgb(var(--primary))' }}
        >
          {t('installSwapModule')} →
        </button>
      )}
    </div>
  )
}

/**
 * Parse a decimal amount string to wei (bigint)
 */
function parseAmountToWei(amount: string, decimals: number): bigint {
  if (!amount || amount === '0') return 0n

  const [whole, fraction = ''] = amount.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const combined = `${whole}${paddedFraction}`

  return BigInt(combined)
}
