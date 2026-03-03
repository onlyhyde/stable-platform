'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { isAddress, parseUnits } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PaymasterSelector,
  useToast,
} from '@/components/common'
import { BatchRecipientList } from '@/components/payment/BatchRecipientList'
import type { SponsorshipPolicy, SupportedToken, WalletToken } from '@/hooks'
import { usePaymaster, useUserOp, useWallet, useWalletAssets } from '@/hooks'
import { useBatchTransaction } from '@/hooks/useBatchTransaction'
import { useEntryPointDeposit } from '@/hooks/useEntryPointDeposit'
import { formatTokenAmount } from '@/lib/utils'

type SelectedAsset = 'native' | WalletToken

export default function SendPage() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const { native, tokens, isSupported } = useWalletAssets()
  const { sendTransaction, isLoading, error } = useUserOp()
  const { addToast, updateToast } = useToast()

  // Paymaster
  const {
    selectedType: paymasterType,
    setSelectedType: setPaymasterType,
    selectedTokenAddress: paymasterTokenAddress,
    setSelectedTokenAddress: setPaymasterTokenAddress,
    selectedPolicyId: paymasterPolicyId,
    setSelectedPolicyId: setPaymasterPolicyId,
    getSupportedTokens,
    getSponsorshipPolicies,
    checkSponsorshipEligibility,
    isLoading: paymasterLoading,
    error: paymasterError,
  } = usePaymaster()

  // EntryPoint deposit (for self-pay mode)
  const { formattedDeposit, fetchDeposit } = useEntryPointDeposit(address)

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>('native')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Paymaster sub-selector state
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[] | null>(null)
  const [sponsorPolicies, setSponsorPolicies] = useState<SponsorshipPolicy[] | null>(null)
  const [sponsorEligible, setSponsorEligible] = useState<boolean | null>(null)
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false)

  // Fetch EntryPoint deposit when self-pay ('none') mode selected
  useEffect(() => {
    if (paymasterType === ('none' as string) && address) {
      fetchDeposit()
    }
  }, [paymasterType, address, fetchDeposit])

  // Fetch tokens when erc20/permit2 selected
  useEffect(() => {
    if (paymasterType === 'erc20' || paymasterType === 'permit2') {
      setIsLoadingTokens(true)
      getSupportedTokens()
        .then(setSupportedTokens)
        .finally(() => setIsLoadingTokens(false))
    }
  }, [paymasterType, getSupportedTokens])

  // Check eligibility & fetch policies when sponsor selected
  useEffect(() => {
    if (paymasterType === 'sponsor' && address) {
      checkSponsorshipEligibility(address).then((r) => setSponsorEligible(r?.eligible ?? false))
      setIsLoadingPolicies(true)
      getSponsorshipPolicies()
        .then(setSponsorPolicies)
        .finally(() => setIsLoadingPolicies(false))
    }
  }, [paymasterType, address, checkSponsorshipEligibility, getSponsorshipPolicies])

  // Batch transaction hook
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

  // Get balance info from selected asset
  const balance =
    selectedAsset === 'native'
      ? BigInt(native?.balance || '0')
      : BigInt(selectedAsset.balance || '0')
  const decimals = selectedAsset === 'native' ? (native?.decimals ?? 18) : selectedAsset.decimals
  const symbol = selectedAsset === 'native' ? (native?.symbol ?? 'ETH') : selectedAsset.symbol
  const isNativeAsset = selectedAsset === 'native'

  // Single-mode validation
  const isValidRecipient = recipient === '' || isAddress(recipient)
  const isValidAmount = amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0)

  let exceedsBalance = false
  if (!isBatchMode && amount && !Number.isNaN(Number(amount)) && Number(amount) > 0) {
    try {
      const parsedAmount = parseUnits(amount, decimals)
      exceedsBalance = parsedAmount > balance
    } catch {
      // parseUnits may throw on invalid input
    }
  }

  // Batch-mode validation
  let batchTotal = 0n
  let batchExceedsBalance = false
  if (isBatchMode) {
    for (const r of batchRecipients) {
      if (r.amount && Number(r.amount) > 0) {
        try {
          batchTotal += parseUnits(r.amount, decimals)
        } catch {
          // skip invalid
        }
      }
    }
    batchExceedsBalance = batchTotal > balance
  }

  const batchValidCount = batchRecipients.filter(
    (r) => isAddress(r.address) && r.amount && Number(r.amount) > 0
  ).length

  const canSend = isBatchMode
    ? batchValidCount >= 2 && !batchExceedsBalance && isConnected && address
    : isAddress(recipient) && Number(amount) > 0 && !exceedsBalance && isConnected && address

  // Gas savings for batch mode
  const gasSavings = estimateGasSavings(Math.max(batchValidCount, 2), isNativeAsset)

  async function handleSend() {
    if (!canSend || !address) return
    setSendError(null)

    const toastId = addToast({
      type: 'loading',
      title: 'Sending Transaction',
      message: `Transferring ${amount} ${symbol} to ${recipient.slice(0, 8)}...`,
      persistent: true,
    })

    const result = await sendTransaction(address, recipient as Address, amount)
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
      const msg = 'Transaction failed on-chain. Please check your balance and try again.'
      updateToast(toastId, {
        type: 'error',
        title: 'Transaction Failed',
        message: msg,
        txHash: result.transactionHash,
        persistent: false,
      })
      setSendError(msg)
    } else {
      const msg = error?.message ?? 'Transaction failed. Please try again.'
      updateToast(toastId, {
        type: 'error',
        title: 'Transaction Error',
        message: msg,
        persistent: false,
      })
      setSendError(msg)
    }
  }

  async function handleBatchSend() {
    if (!canSend || !address) return
    setSendError(null)

    const toastId = addToast({
      type: 'loading',
      title: 'Sending Batch Transaction',
      message: `Sending ${batchValidCount} transfers in one transaction...`,
      persistent: true,
    })

    const result = await executeBatch({
      isNative: isNativeAsset,
      tokenAddress: !isNativeAsset ? ((selectedAsset as WalletToken).address as Address) : undefined,
      decimals,
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
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>
          Please connect your wallet to send payments
        </p>
      </div>
    )
  }

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
          {/* Asset Selector (for StableNet wallet) */}
          {isSupported && tokens.length > 0 && (
            <div>
              <span
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                Select Asset
              </span>
              <div className="grid grid-cols-2 gap-2">
                {/* Native token option */}
                <button
                  type="button"
                  onClick={() => setSelectedAsset('native')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedAsset === 'native' ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor:
                      selectedAsset === 'native'
                        ? 'rgb(var(--primary) / 0.1)'
                        : 'rgb(var(--secondary))',
                    borderColor:
                      selectedAsset === 'native' ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                    ...(selectedAsset === 'native' &&
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
                {/* Token options */}
                {tokens.slice(0, 5).map((token) => (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => setSelectedAsset(token)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedAsset !== 'native' && selectedAsset.address === token.address
                        ? 'ring-2'
                        : ''
                    }`}
                    style={{
                      backgroundColor:
                        selectedAsset !== 'native' && selectedAsset.address === token.address
                          ? 'rgb(var(--primary) / 0.1)'
                          : 'rgb(var(--secondary))',
                      borderColor:
                        selectedAsset !== 'native' && selectedAsset.address === token.address
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--border))',
                    }}
                  >
                    <p className="font-medium truncate" style={{ color: 'rgb(var(--foreground))' }}>
                      {token.symbol}
                    </p>
                    <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      {token.formattedBalance}
                    </p>
                  </button>
                ))}
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

          {/* --- Single Transfer Mode --- */}
          {!isBatchMode && (
            <>
              {/* Recipient */}
              <Input
                label="Recipient Address"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                error={!isValidRecipient ? 'Invalid address' : undefined}
              />

              {/* Amount */}
              <Input
                label={`Amount (${symbol})`}
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={
                  !isValidAmount
                    ? 'Invalid amount'
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

          {/* --- Batch Transfer Mode --- */}
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

          {/* Gas Info */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            {isBatchMode && batchValidCount >= 2 ? (
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
            ) : (
              <PaymasterSelector
                selectedType={paymasterType}
                onTypeChange={setPaymasterType}
                supportedTokens={supportedTokens}
                selectedTokenAddress={paymasterTokenAddress}
                onTokenSelect={setPaymasterTokenAddress}
                isLoadingTokens={isLoadingTokens}
                sponsorshipPolicies={sponsorPolicies}
                selectedPolicyId={paymasterPolicyId}
                onPolicySelect={setPaymasterPolicyId}
                isLoadingPolicies={isLoadingPolicies}
                sponsorEligible={sponsorEligible}
                depositBalance={formattedDeposit}
                isLoading={paymasterLoading}
                error={paymasterError?.message}
              />
            )}
          </div>

          {/* Error */}
          {(error || sendError || batchError) && (
            <div
              className="p-3 rounded-lg border"
              style={{
                backgroundColor: 'rgb(var(--destructive) / 0.1)',
                borderColor: 'rgb(var(--destructive) / 0.3)',
              }}
            >
              <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
                {sendError ?? batchError ?? error?.message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={isBatchMode ? handleBatchSend : handleSend}
              disabled={!canSend}
              isLoading={isBatchMode ? isBatchExecuting : isLoading}
              className="flex-1"
            >
              {isBatchMode ? `Send Batch (${batchValidCount})` : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
