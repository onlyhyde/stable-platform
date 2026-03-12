'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, isAddress, parseEther, parseUnits } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from '@/components/common'
import { PaymasterSelector, type GasPaymentMode } from '@/components/common/PaymasterSelector'
import { BatchRecipientList } from '@/components/payment/BatchRecipientList'
import type { SupportedToken, WalletToken } from '@/hooks'
import { useUserOp, useWallet, useWalletAssets } from '@/hooks'
import { useBatchTransaction } from '@/hooks/useBatchTransaction'
import { useEntryPointDeposit } from '@/hooks/useEntryPointDeposit'
import { usePaymaster } from '@/hooks/usePaymaster'
import { usePaymasterHealth } from '@/hooks/usePaymasterHealth'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useTokenGasEstimate } from '@/hooks/useTokenGasEstimate'
import type { GasPaymentContext } from '@/hooks/useUserOp'
import { getUserFriendlyError, parseAAError } from '@/lib/aaErrors'
import { formatTokenAmount } from '@/lib/utils'
import { useStableNetContext } from '@/providers'

// ============================================================================
// Types
// ============================================================================

type SelectedAsset = 'native' | WalletToken
type SendStep = 'form' | 'review' | 'pending'

/** Default deposit amount for EntryPoint top-up */
const DEPOSIT_AMOUNT = '0.01'

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

// ============================================================================
// Component
// ============================================================================

export default function SendPage() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const { chainId } = useStableNetContext()
  const { native, tokens, isSupported } = useWalletAssets()
  const { sendUserOp, isLoading, error } = useUserOp()
  const { addToast, updateToast } = useToast()

  // Paymaster hooks
  const {
    paymasterAddress,
    getSupportedTokens,
    checkSponsorshipEligibility,
    isLoading: paymasterLoading,
    error: paymasterError,
  } = usePaymaster()

  const { formattedDeposit, fetchDeposit } = useEntryPointDeposit(address)
  const {
    formattedTokenCost,
    isLoading: isEstimatingGas,
    estimateTokenCost,
  } = useTokenGasEstimate()
  const { isHealthy: paymasterHealthy } = usePaymasterHealth()
  const {
    status: erc20ApprovalStatus,
    error: erc20ApprovalError,
    checkAllowance,
    approve: approveToken,
    reset: resetApproval,
  } = useTokenApproval()

  // ── Step state ──
  const [step, setStep] = useState<SendStep>('form')

  // ── Form state ──
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>('native')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // ── Gas payment state (3 modes: native, sponsor, erc20) ──
  const [gasMode, setGasMode] = useState<GasPaymentMode>('sponsor')
  const [gasTokenAddress, setGasTokenAddress] = useState<Address | undefined>(undefined)
  const [isDepositing, setIsDepositing] = useState(false)

  // ── Paymaster sub-state ──
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[] | null>(null)
  const [sponsorAvailable, setSponsorAvailable] = useState<boolean | null>(null)
  const [sponsorReason, setSponsorReason] = useState<string | undefined>(undefined)
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)

  // ── Derived values ──
  const isNativeAsset = selectedAsset === 'native'
  const balance = isNativeAsset
    ? BigInt(native?.balance || '0')
    : BigInt(selectedAsset.balance || '0')
  const decimals = isNativeAsset ? (native?.decimals ?? 18) : selectedAsset.decimals
  const symbol = isNativeAsset ? (native?.symbol ?? 'ETH') : selectedAsset.symbol

  // ── Effects: fetch data based on gas mode ──

  // Fetch EntryPoint deposit when native mode selected
  useEffect(() => {
    if (gasMode === 'native' && address) {
      fetchDeposit()
    }
  }, [gasMode, address, fetchDeposit])

  // Check sponsorship eligibility
  useEffect(() => {
    if (gasMode === 'sponsor' && address) {
      checkSponsorshipEligibility(address).then((r) => {
        setSponsorAvailable(r?.eligible ?? false)
        if (r && !r.eligible) {
          setSponsorReason(r.reason)
        }
      })
    }
  }, [gasMode, address, checkSponsorshipEligibility])

  // Fetch tokens when erc20 selected
  useEffect(() => {
    if (gasMode === 'erc20') {
      setIsLoadingTokens(true)
      getSupportedTokens()
        .then(setSupportedTokens)
        .finally(() => setIsLoadingTokens(false))
    }
  }, [gasMode, getSupportedTokens])

  // Check ERC-20 allowance when token selected
  useEffect(() => {
    if (gasMode === 'erc20' && gasTokenAddress && address && paymasterAddress) {
      checkAllowance(gasTokenAddress, address, paymasterAddress)
    }
    if (gasMode !== 'erc20') {
      resetApproval()
    }
  }, [gasMode, gasTokenAddress, address, paymasterAddress, checkAllowance, resetApproval])

  // Estimate token gas cost when token selected in erc20 mode
  useEffect(() => {
    if (gasMode === 'erc20' && gasTokenAddress && address) {
      const selectedToken = supportedTokens?.find((t) => t.address === gasTokenAddress)
      estimateTokenCost(gasTokenAddress, { sender: address }, selectedToken?.decimals ?? 18)
    }
  }, [gasMode, gasTokenAddress, address, supportedTokens, estimateTokenCost])

  // ── Batch transaction hook ──
  const {
    recipients: batchRecipients,
    addRecipient,
    removeRecipient,
    updateRecipient,
    clearRecipients,
    executeBatch,
    estimateGasSavings,
    isExecuting: isBatchExecuting,
    error: batchError,
  } = useBatchTransaction()

  // ── Validation ──
  // ── Gas mode change handler (resets stale ERC-20 state) ──
  const handleGasModeChange = useCallback(
    (mode: GasPaymentMode) => {
      setGasMode(mode)
      if (mode !== 'erc20') {
        setSupportedTokens(null)
        setGasTokenAddress(undefined)
        resetApproval()
      }
    },
    [resetApproval]
  )

  // ── Validation ──
  const isValidRecipient = recipient === '' || isAddress(recipient)

  // Validate amount: positive number within token decimal precision
  const hasExcessDecimals =
    amount !== '' && amount.includes('.') && amount.split('.')[1].length > decimals
  const isValidAmount =
    amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0 && !hasExcessDecimals)

  const exceedsBalance = useMemo(() => {
    if (isBatchMode || !amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return false
    }
    try {
      return parseUnits(amount, decimals) > balance
    } catch {
      return false
    }
  }, [isBatchMode, amount, decimals, balance])

  const { batchTotal, batchExceedsBalance, batchParseErrors } = useMemo(() => {
    if (!isBatchMode) return { batchTotal: 0n, batchExceedsBalance: false, batchParseErrors: 0 }
    let total = 0n
    let parseErrors = 0
    for (const r of batchRecipients) {
      if (r.amount && Number(r.amount) > 0) {
        try {
          total += parseUnits(r.amount, decimals)
        } catch {
          parseErrors++
        }
      }
    }
    return { batchTotal: total, batchExceedsBalance: total > balance, batchParseErrors: parseErrors }
  }, [isBatchMode, batchRecipients, decimals, balance])

  const batchValidCount = batchRecipients.filter(
    (r) => isAddress(r.address) && r.amount && Number(r.amount) > 0
  ).length

  const canSend = isBatchMode
    ? batchValidCount >= 2 && !batchExceedsBalance && isConnected && !!address
    : isAddress(recipient) && Number(amount) > 0 && !exceedsBalance && isConnected && !!address

  const gasSavings = estimateGasSavings(Math.max(batchValidCount, 2), isNativeAsset)

  // ── Handlers ──

  const buildGasPayment = useCallback((): GasPaymentContext | undefined => {
    if (gasMode === 'native') {
      return undefined // Self-pay: no paymaster
    }
    if (gasMode === 'sponsor') {
      return { type: 'sponsor' }
    }
    if (gasMode === 'erc20' && gasTokenAddress) {
      return { type: 'erc20', tokenAddress: gasTokenAddress }
    }
    return undefined
  }, [gasMode, gasTokenAddress])

  const handleDepositTopUp = useCallback(async () => {
    if (!address) return
    setIsDepositing(true)
    try {
      const { entryPoint } = await import('@/hooks/useSmartAccount').then((m) =>
        m.getSmartAccountAddresses(chainId)
      )
      const depositCalldata = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'depositTo',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [],
            stateMutability: 'payable',
          },
        ],
        functionName: 'depositTo',
        args: [address],
      })
      const result = await sendUserOp(address, {
        to: entryPoint,
        value: parseEther(DEPOSIT_AMOUNT),
        data: depositCalldata as Hex,
      })
      if (result?.success) {
        addToast({
          type: 'success',
          title: 'Deposit Sent',
          message: `${DEPOSIT_AMOUNT} ${native?.symbol ?? 'WKRC'} deposited to EntryPoint`,
        })
        fetchDeposit()
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Deposit Failed',
        message: 'Failed to top up EntryPoint deposit',
      })
    } finally {
      setIsDepositing(false)
    }
  }, [address, chainId, sendUserOp, addToast, fetchDeposit])

  const handleReview = useCallback(() => {
    if (canSend) {
      setSendError(null)
      setStep('review')
    }
  }, [canSend])

  const handleSend = useCallback(async () => {
    if (!canSend || !address) return
    setSendError(null)
    setStep('pending')

    const toastId = addToast({
      type: 'loading',
      title: 'Sending Transaction',
      message: `Transferring ${amount} ${symbol}...`,
      persistent: true,
    })

    const gasPayment = buildGasPayment()

    // Build transaction params — handle ERC-20 token transfers
    const isTokenTransfer = !isNativeAsset
    const to: Address = isTokenTransfer
      ? (selectedAsset as WalletToken).address
      : (recipient as Address)
    const value: bigint = isTokenTransfer ? 0n : parseEther(amount)
    const data: Hex = isTokenTransfer
      ? encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [recipient as Address, parseUnits(amount, decimals)],
        })
      : '0x'

    const result = await sendUserOp(address, { to, value, data, gasPayment })

    if (result?.success && result.status === 'confirmed') {
      updateToast(toastId, {
        type: 'success',
        title: 'Transaction Confirmed',
        message: `${amount} ${symbol} sent successfully`,
        txHash: result.transactionHash,
        persistent: false,
      })
      router.push('/payment/history')
    } else if (result?.status === 'submitted') {
      updateToast(toastId, {
        type: 'info',
        title: 'Transaction Submitted',
        message: 'Awaiting on-chain confirmation...',
        txHash: result.userOpHash,
        persistent: false,
      })
      router.push('/payment/history?pending=true')
    } else if (result && !result.success) {
      const msg = getUserFriendlyError(
        'Transaction failed on-chain. Please check your balance and try again.'
      )
      updateToast(toastId, {
        type: 'error',
        title: 'Transaction Failed',
        message: msg,
        txHash: result.transactionHash,
        persistent: false,
      })
      setSendError(msg)
      setStep('form')
    } else {
      // result === null means sendUserOp failed before submission
      // (e.g. provider not detected, wallet rejected)
      const msg = getUserFriendlyError(
        'Transaction failed. Please check your wallet connection and try again.'
      )
      updateToast(toastId, {
        type: 'error',
        title: 'Transaction Error',
        message: msg,
        persistent: false,
      })
      setSendError(msg)
      setStep('form')
    }
  }, [
    canSend,
    address,
    amount,
    symbol,
    isNativeAsset,
    selectedAsset,
    recipient,
    decimals,
    addToast,
    updateToast,
    buildGasPayment,
    sendUserOp,
    router,
  ])

  const handleBatchSend = useCallback(async () => {
    if (!canSend || !address) return
    setSendError(null)
    setStep('pending')

    const toastId = addToast({
      type: 'loading',
      title: 'Sending Batch Transaction',
      message: `Sending ${batchValidCount} transfers in one transaction...`,
      persistent: true,
    })

    const gasPayment = buildGasPayment()
    const result = await executeBatch({
      isNative: isNativeAsset,
      tokenAddress: !isNativeAsset
        ? ((selectedAsset as WalletToken).address as Address)
        : undefined,
      decimals,
      gasPayment,
    })

    if (result.success) {
      updateToast(toastId, {
        type: 'success',
        title: 'Batch Confirmed',
        message: `${batchValidCount} transfers completed successfully`,
        txHash: result.txHash,
        persistent: false,
      })
      clearRecipients()
      router.push('/payment/history')
    } else {
      const msg = result.error ?? 'Batch transaction failed'
      updateToast(toastId, {
        type: 'error',
        title: 'Batch Failed',
        message: msg,
        txHash: result.txHash,
        persistent: false,
      })
      setSendError(msg)
      setStep('form')
    }
  }, [
    canSend,
    address,
    batchValidCount,
    isNativeAsset,
    selectedAsset,
    decimals,
    addToast,
    updateToast,
    buildGasPayment,
    executeBatch,
    clearRecipients,
    router,
  ])

  // ── Guard: Not connected ──
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to send payments
        </p>
      </div>
    )
  }

  // ── Render: Pending Step ──
  if (step === 'pending') {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex justify-center mb-4">
              <div
                className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
              />
            </div>
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: 'rgb(var(--foreground))' }}
            >
              {isBatchMode ? 'Sending Batch Transaction...' : 'Sending Transaction...'}
            </h3>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Please confirm in your wallet and wait for on-chain confirmation
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render: Review Step ──
  if (step === 'review') {
    const gasTokenSymbol =
      supportedTokens?.find((t) => t.address === gasTokenAddress)?.symbol ?? 'Token'
    const gasLabel =
      gasMode === 'sponsor'
        ? 'Free (Sponsored)'
        : gasMode === 'erc20' && formattedTokenCost
          ? `~${formattedTokenCost} ${gasTokenSymbol}`
          : 'Native (Self-Pay)'

    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            Review Transaction
          </h1>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>
            Confirm the details before sending
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            {/* Transaction Summary */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
              <div className="space-y-3 text-sm">
                {!isBatchMode && (
                  <>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgb(var(--muted-foreground))' }}>To</span>
                      <span className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                        {recipient
                          ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgb(var(--muted-foreground))' }}>Amount</span>
                      <span style={{ color: 'rgb(var(--foreground))' }}>
                        {amount} {symbol}
                      </span>
                    </div>
                  </>
                )}
                {isBatchMode && (
                  <>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgb(var(--muted-foreground))' }}>Recipients</span>
                      <span style={{ color: 'rgb(var(--foreground))' }}>
                        {batchValidCount} addresses
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgb(var(--muted-foreground))' }}>Total Amount</span>
                      <span style={{ color: 'rgb(var(--foreground))' }}>
                        {formatTokenAmount(batchTotal, decimals)} {symbol}
                      </span>
                    </div>
                  </>
                )}
                <div
                  className="flex justify-between pt-2 border-t"
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  <span style={{ color: 'rgb(var(--muted-foreground))' }}>Gas Payment</span>
                  <span
                    style={{
                      color:
                        gasMode === 'sponsor'
                          ? 'rgb(var(--success, 34 197 94))'
                          : 'rgb(var(--foreground))',
                    }}
                  >
                    {gasLabel}
                  </span>
                </div>
                {!isNativeAsset && (
                  <div className="flex justify-between">
                    <span style={{ color: 'rgb(var(--muted-foreground))' }}>Asset</span>
                    <span style={{ color: 'rgb(var(--foreground))' }}>
                      {symbol} (ERC-20)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep('form')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={isBatchMode ? handleBatchSend : handleSend}
                isLoading={isBatchMode ? isBatchExecuting : isLoading}
                className="flex-1"
              >
                Confirm & Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render: Form Step ──
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Send
        </h1>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Transfer tokens to another address</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex rounded-lg p-1" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <button
          type="button"
          onClick={() => setIsBatchMode(false)}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: !isBatchMode ? 'rgb(var(--background))' : 'transparent',
            color: !isBatchMode ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
            boxShadow: !isBatchMode ? '0 1px 2px rgb(0 0 0 / 0.05)' : 'none',
          }}
        >
          Single Transfer
        </button>
        <button
          type="button"
          onClick={() => setIsBatchMode(true)}
          className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all"
          style={{
            backgroundColor: isBatchMode ? 'rgb(var(--background))' : 'transparent',
            color: isBatchMode ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
            boxShadow: isBatchMode ? '0 1px 2px rgb(0 0 0 / 0.05)' : 'none',
          }}
        >
          Batch Transfer
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isBatchMode ? 'Batch Transfer' : 'Transfer Details'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Asset Selector */}
          {tokens.length > 0 && (
            <div>
              <span
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                Select Asset
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAsset('native')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isNativeAsset ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: isNativeAsset
                      ? 'rgb(var(--primary) / 0.1)'
                      : 'rgb(var(--secondary))',
                    borderColor: isNativeAsset
                      ? 'rgb(var(--primary))'
                      : 'rgb(var(--border))',
                    ...(isNativeAsset &&
                      ({ '--tw-ring-color': 'rgb(var(--primary) / 0.3)' } as React.CSSProperties)),
                  }}
                >
                  <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                    {native?.symbol || 'ETH'}
                  </p>
                  <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {native?.formattedBalance || '0'}
                  </p>
                </button>
                {tokens.slice(0, 5).map((token) => {
                  const isSelected =
                    !isNativeAsset && (selectedAsset as WalletToken).address === token.address
                  return (
                    <button
                      key={token.address}
                      type="button"
                      onClick={() => setSelectedAsset(token)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? 'rgb(var(--primary) / 0.1)'
                          : 'rgb(var(--secondary))',
                        borderColor: isSelected
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--border))',
                      }}
                    >
                      <p
                        className="font-medium truncate"
                        style={{ color: 'rgb(var(--foreground))' }}
                      >
                        {token.symbol}
                      </p>
                      <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {token.formattedBalance}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Balance */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Available Balance
            </p>
            <p className="text-xl font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              {formatTokenAmount(balance, decimals)} {symbol}
            </p>
          </div>

          {/* Single Transfer */}
          {!isBatchMode && (
            <>
              <Input
                label="Recipient Address"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                error={!isValidRecipient ? 'Invalid address' : undefined}
              />
              <Input
                label={`Amount (${symbol})`}
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={
                  !isValidAmount
                    ? 'Invalid amount'
                    : hasExcessDecimals
                      ? `Maximum ${decimals} decimal places for ${symbol}`
                      : exceedsBalance
                        ? 'Amount exceeds available balance'
                        : undefined
                }
                rightElement={
                  <button
                    type="button"
                    onClick={() => setAmount(formatTokenAmount(balance, decimals))}
                    className="text-sm font-medium transition-colors"
                    style={{ color: 'rgb(var(--primary))' }}
                  >
                    MAX
                  </button>
                }
              />
            </>
          )}

          {/* Batch Transfer */}
          {isBatchMode && (
            <BatchRecipientList
              recipients={batchRecipients}
              onUpdate={updateRecipient}
              onRemove={removeRecipient}
              onAdd={addRecipient}
              symbol={symbol}
              decimals={decimals}
              balance={balance}
            />
          )}

          {/* Batch Gas Savings */}
          {isBatchMode && batchValidCount >= 2 && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                    Individual ({batchValidCount} txns)
                  </span>
                  <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                    ~{Number(gasSavings.individual).toLocaleString()} gas
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgb(var(--foreground))' }} className="font-medium">
                    Batch (1 txn)
                  </span>
                  <span style={{ color: 'rgb(var(--foreground))' }} className="font-medium">
                    ~{Number(gasSavings.batch).toLocaleString()} gas
                  </span>
                </div>
                <div
                  className="flex justify-between text-sm pt-1 border-t"
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  <span style={{ color: 'rgb(var(--success))' }} className="font-medium">
                    Estimated Savings
                  </span>
                  <span style={{ color: 'rgb(var(--success))' }} className="font-medium">
                    ~{gasSavings.savingsPercent}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Gas Payment Selection */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <PaymasterSelector
              selectedMode={gasMode}
              onModeChange={handleGasModeChange}
              depositBalance={formattedDeposit}
              onDepositTopUp={handleDepositTopUp}
              isDepositing={isDepositing}
              sponsorAvailable={sponsorAvailable}
              sponsorUnavailableReason={sponsorReason}
              supportedTokens={supportedTokens}
              selectedTokenAddress={gasTokenAddress}
              onTokenSelect={setGasTokenAddress}
              isLoadingTokens={isLoadingTokens}
              tokenGasEstimate={
                formattedTokenCost
                  ? {
                      formattedCost: formattedTokenCost,
                      symbol:
                        supportedTokens?.find((t) => t.address === gasTokenAddress)?.symbol ??
                        'Token',
                    }
                  : null
              }
              isEstimatingGas={isEstimatingGas}
              erc20ApprovalStatus={erc20ApprovalStatus}
              onErc20Approve={
                gasTokenAddress && address && paymasterAddress
                  ? () => approveToken(gasTokenAddress, address, paymasterAddress)
                  : undefined
              }
              erc20ApprovalError={erc20ApprovalError?.message}
              paymasterHealthy={paymasterHealthy}
              isLoading={paymasterLoading}
              error={paymasterError?.message}
            />
          </div>

          {/* Error Display */}
          {/* Batch parse errors warning */}
          {isBatchMode && batchParseErrors > 0 && (
            <div
              className="p-3 rounded-lg border"
              style={{
                backgroundColor: 'rgb(var(--warning) / 0.1)',
                borderColor: 'rgb(var(--warning) / 0.3)',
              }}
            >
              <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}>
                {batchParseErrors} recipient(s) have invalid amounts (e.g. too many decimal places).
                These will be skipped.
              </p>
            </div>
          )}

          {(error || sendError || batchError || paymasterError) &&
            (() => {
              const errorMsg =
                sendError ?? batchError ?? paymasterError?.message ?? error?.message ?? ''
              const aaError = parseAAError(errorMsg)
              return (
                <div
                  className="p-3 rounded-lg border space-y-2"
                  style={{
                    backgroundColor: 'rgb(var(--destructive) / 0.1)',
                    borderColor: 'rgb(var(--destructive) / 0.3)',
                  }}
                >
                  <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
                    {aaError ? aaError.message : errorMsg}
                  </p>
                  {aaError?.suggestion && (
                    <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      {aaError.suggestion}
                    </p>
                  )}
                  {aaError?.action === 'deposit' && (
                    <button
                      type="button"
                      onClick={() => {
                        setGasMode('native')
                        setSendError(null)
                      }}
                      className="text-xs font-medium underline"
                      style={{ color: 'rgb(var(--primary))' }}
                    >
                      Switch to Self-Pay & Top Up Deposit
                    </button>
                  )}
                  {aaError?.action === 'change-mode' && (
                    <button
                      type="button"
                      onClick={() => setSendError(null)}
                      className="text-xs font-medium underline"
                      style={{ color: 'rgb(var(--primary))' }}
                    >
                      Try a Different Gas Payment Method
                    </button>
                  )}
                </div>
              )
            })()}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={!canSend}
              className="flex-1"
            >
              {isBatchMode ? `Review Batch (${batchValidCount})` : 'Review'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
