'use client'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/common'
import { useUserOp, useWallet, useWalletAssets } from '@/hooks'
import type { WalletToken } from '@/hooks'
import { formatTokenAmount } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { isAddress } from 'viem'

type SelectedAsset = 'native' | WalletToken

export default function SendPage() {
  const router = useRouter()
  const { address, isConnected } = useWallet()
  const { native, tokens, isSupported } = useWalletAssets()
  const { sendTransaction, isLoading, error } = useUserOp()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>('native')

  // Get balance info from selected asset
  const balance =
    selectedAsset === 'native'
      ? BigInt(native?.balance || '0')
      : BigInt(selectedAsset.balance || '0')
  const decimals = selectedAsset === 'native' ? (native?.decimals ?? 18) : selectedAsset.decimals
  const symbol = selectedAsset === 'native' ? (native?.symbol ?? 'ETH') : selectedAsset.symbol

  const isValidRecipient = recipient === '' || isAddress(recipient)
  const isValidAmount = amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0)
  const canSend = isAddress(recipient) && Number(amount) > 0 && isConnected && address

  async function handleSend() {
    if (!canSend || !address) return

    const result = await sendTransaction(address, recipient as `0x${string}`, amount)
    if (result?.success) {
      router.push('/payment/history')
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

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
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
            error={!isValidAmount ? 'Invalid amount' : undefined}
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

          {/* Gas Info */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Gas fees will be sponsored by the Paymaster
            </p>
          </div>

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
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              isLoading={isLoading}
              className="flex-1"
            >
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
