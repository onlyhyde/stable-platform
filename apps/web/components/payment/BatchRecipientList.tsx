'use client'

import { isAddress, parseUnits } from 'viem'
import { Input } from '@/components/common'
import type { BatchRecipient } from '@/hooks/useBatchTransaction'
import { formatTokenAmount } from '@/lib/utils'

interface BatchRecipientListProps {
  recipients: BatchRecipient[]
  onUpdate: (id: string, field: 'address' | 'amount', value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  symbol: string
  decimals: number
  balance: bigint
}

export function BatchRecipientList({
  recipients,
  onUpdate,
  onRemove,
  onAdd,
  symbol,
  decimals,
  balance,
}: BatchRecipientListProps) {
  // Calculate total across all recipients
  let totalAmount = 0n
  let parseError = false
  for (const r of recipients) {
    if (r.amount && Number(r.amount) > 0) {
      try {
        totalAmount += parseUnits(r.amount, decimals)
      } catch {
        parseError = true
      }
    }
  }

  const exceedsBalance = totalAmount > balance
  const validCount = recipients.filter(
    (r) => r.amount && Number(r.amount) > 0 && isAddress(r.address)
  ).length

  return (
    <div className="space-y-3">
      {recipients.map((recipient, index) => {
        const isValidAddr = recipient.address === '' || isAddress(recipient.address)
        const isValidAmt =
          recipient.amount === '' ||
          (!Number.isNaN(Number(recipient.amount)) && Number(recipient.amount) > 0)

        return (
          <div
            key={recipient.id}
            className="p-3 rounded-lg border space-y-2"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-medium"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                #{index + 1}
              </span>
              {recipients.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemove(recipient.id)}
                  className="text-xs px-2 py-0.5 rounded transition-colors"
                  style={{ color: 'rgb(var(--destructive))' }}
                >
                  Remove
                </button>
              )}
            </div>
            <Input
              placeholder="Recipient address (0x...)"
              value={recipient.address}
              onChange={(e) => onUpdate(recipient.id, 'address', e.target.value)}
              error={!isValidAddr ? 'Invalid address' : undefined}
            />
            <Input
              type="number"
              placeholder="0.0"
              value={recipient.amount}
              onChange={(e) => onUpdate(recipient.id, 'amount', e.target.value)}
              error={!isValidAmt ? 'Invalid amount' : undefined}
              rightElement={
                <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {symbol}
                </span>
              }
            />
          </div>
        )
      })}

      <button
        type="button"
        onClick={onAdd}
        className="w-full p-3 rounded-lg border border-dashed text-sm font-medium transition-colors hover:opacity-80"
        style={{
          borderColor: 'rgb(var(--border))',
          color: 'rgb(var(--primary))',
        }}
      >
        + Add Recipient
      </button>

      {/* Total summary */}
      <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Total ({validCount} of {recipients.length} transfers)
            </p>
            <p
              className="text-lg font-semibold"
              style={{
                color:
                  exceedsBalance || parseError
                    ? 'rgb(var(--destructive))'
                    : 'rgb(var(--foreground))',
              }}
            >
              {parseError
                ? 'Invalid amounts'
                : `${formatTokenAmount(totalAmount, decimals)} ${symbol}`}
            </p>
          </div>
          {exceedsBalance && !parseError && (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'rgb(var(--destructive))' }}
            >
              Exceeds balance
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
