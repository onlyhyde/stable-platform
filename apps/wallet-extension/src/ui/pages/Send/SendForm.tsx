import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address } from 'viem'

interface SendFormProps {
  formData: {
    recipient: Address | ''
    amount: string
    data: string
  }
  onFormChange: (field: 'recipient' | 'amount' | 'data', value: string) => void
  isValid: boolean
  currencySymbol?: string
}

/**
 * Send form component for entering transaction details
 */
export function SendForm({ formData, onFormChange, currencySymbol = 'ETH' }: SendFormProps) {
  const { t } = useTranslation('send')
  const handleRecipientChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFormChange('recipient', e.target.value)
    },
    [onFormChange]
  )

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow only valid number input
      const value = e.target.value
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        onFormChange('amount', value)
      }
    },
    [onFormChange]
  )

  return (
    <div className="send-form space-y-4">
      {/* Recipient Address */}
      <div className="form-group">
        <label
          htmlFor="recipient-input"
          className="block text-sm font-medium mb-1"
          style={{ color: 'rgb(var(--foreground-secondary))' }}
        >
          {t('recipientAddress')}
        </label>
        <input
          id="recipient-input"
          type="text"
          className="w-full px-3 py-2 rounded-lg input-base"
          placeholder={t('recipientPlaceholder')}
          value={formData.recipient}
          onChange={handleRecipientChange}
        />
      </div>

      {/* Amount */}
      <div className="form-group">
        <label
          htmlFor="amount-input"
          className="block text-sm font-medium mb-1"
          style={{ color: 'rgb(var(--foreground-secondary))' }}
        >
          {t('amount')}
        </label>
        <div className="relative">
          <input
            id="amount-input"
            type="text"
            className="w-full px-3 py-2 pr-16 rounded-lg input-base"
            placeholder={t('amountPlaceholder')}
            value={formData.amount}
            onChange={handleAmountChange}
          />
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            {currencySymbol}
          </span>
        </div>
      </div>

      {/* Advanced: Data field (collapsible) */}
      <details className="form-group">
        <summary
          className="cursor-pointer text-sm"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          {t('advancedOptions')}
        </summary>
        <div className="mt-2">
          <label
            htmlFor="data-input"
            className="block text-sm font-medium mb-1"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {t('dataHex')}
          </label>
          <textarea
            id="data-input"
            className="w-full px-3 py-2 rounded-lg input-base font-mono text-sm"
            placeholder={t('dataPlaceholder')}
            value={formData.data}
            onChange={(e) => onFormChange('data', e.target.value)}
            rows={3}
          />
        </div>
      </details>
    </div>
  )
}
