'use client'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/common'

interface StealthTransferCardProps {
  balance: bigint
  decimals: number
  symbol: string
  stealthMetaAddress: string
  onStealthMetaAddressChange: (value: string) => void
  amount: string
  onAmountChange: (value: string) => void
  generatedAddress: string | null
  isLoading: boolean
  isSending?: boolean
  canGenerate: boolean
  onGenerate: () => void
  onSend: () => void
  onCancel: () => void
  error?: Error | null
  txHash?: string | null
  formatTokenAmount: (amount: bigint, decimals: number) => string
}

export function StealthTransferCard({
  balance,
  decimals,
  symbol,
  stealthMetaAddress,
  onStealthMetaAddressChange,
  amount,
  onAmountChange,
  generatedAddress,
  isLoading,
  isSending = false,
  canGenerate,
  onGenerate,
  onSend,
  onCancel,
  error,
  txHash,
  formatTokenAmount,
}: StealthTransferCardProps) {
  const isValidMetaAddress = stealthMetaAddress === '' || stealthMetaAddress.startsWith('st:eth:')
  const isValidAmount = amount === '' || (!Number.isNaN(Number(amount)) && Number(amount) > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stealth Transfer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Available Balance
          </p>
          <p className="text-xl font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            {formatTokenAmount(balance, decimals)} {symbol}
          </p>
        </div>

        {/* Stealth Meta-Address Input */}
        <Input
          label="Recipient Stealth Meta-Address"
          placeholder="st:eth:0x..."
          value={stealthMetaAddress}
          onChange={(e) => onStealthMetaAddressChange(e.target.value)}
          error={!isValidMetaAddress ? 'Invalid stealth meta-address format' : undefined}
          hint="Enter the recipient's stealth meta-address (starts with st:eth:)"
        />

        {/* Amount */}
        <Input
          label={`Amount (${symbol})`}
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          error={!isValidAmount ? 'Invalid amount' : undefined}
          rightElement={
            <button
              type="button"
              onClick={() => onAmountChange(formatTokenAmount(balance, decimals))}
              className="text-sm font-medium hover:opacity-80"
              style={{ color: 'rgb(var(--primary))' }}
            >
              MAX
            </button>
          }
        />

        {/* Generated Stealth Address */}
        {generatedAddress && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-medium text-green-800">Stealth Address Generated</p>
                <code className="text-xs text-green-700 break-all block mt-1">
                  {generatedAddress}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Info */}
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex gap-2">
            <svg
              className="w-5 h-5 text-purple-600 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <div>
              <p className="text-sm text-purple-800 font-medium">Enhanced Privacy</p>
              <p className="text-xs text-purple-600 mt-0.5">
                A unique one-time address will be generated. Only the recipient can access the
                funds.
              </p>
            </div>
          </div>
        </div>

        {/* Gas Info */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Gas fees will be sponsored by the Paymaster
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error.message}</p>
          </div>
        )}

        {/* Transaction Success */}
        {txHash && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div>
                <p className="font-medium text-green-800">Transaction Sent Successfully</p>
                <code className="text-xs text-green-700 break-all block mt-1">{txHash}</code>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onCancel} className="flex-1" disabled={isSending}>
            Cancel
          </Button>
          {!generatedAddress ? (
            <Button
              onClick={onGenerate}
              disabled={!canGenerate}
              isLoading={isLoading}
              className="flex-1"
            >
              Generate Address
            </Button>
          ) : (
            <Button onClick={onSend} isLoading={isSending} disabled={!!txHash} className="flex-1">
              {txHash ? 'Sent!' : 'Send Privately'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
