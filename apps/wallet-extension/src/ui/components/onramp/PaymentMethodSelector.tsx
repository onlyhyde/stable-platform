import type { PaymentMethod } from '../../../types'

interface PaymentMethodSelectorProps {
  value: PaymentMethod | ''
  onChange: (method: PaymentMethod) => void
  availableMethods?: PaymentMethod[]
  disabled?: boolean
}

const methodConfig: Record<PaymentMethod, { label: string; description: string; icon: string }> = {
  bank_transfer: {
    label: 'Bank Transfer',
    description: 'ACH transfer from your bank account',
    icon: '🏦',
  },
  card: {
    label: 'Credit/Debit Card',
    description: 'Instant with 2.5% fee',
    icon: '💳',
  },
  wire: {
    label: 'Wire Transfer',
    description: 'International wire transfer',
    icon: '🌐',
  },
}

export function PaymentMethodSelector({
  value,
  onChange,
  availableMethods = ['bank_transfer', 'card', 'wire'],
  disabled = false,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-gray-700">Payment Method</span>
      <div className="space-y-2">
        {availableMethods.map((method) => {
          const config = methodConfig[method]
          const isSelected = value === method
          return (
            <button
              key={method}
              type="button"
              onClick={() => onChange(method)}
              disabled={disabled}
              className={`w-full flex items-center gap-3 p-3 border rounded-lg text-left transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-2xl">{config.icon}</span>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    isSelected ? 'text-indigo-900' : 'text-gray-900'
                  }`}
                >
                  {config.label}
                </p>
                <p className="text-xs text-gray-500">{config.description}</p>
              </div>
              {isSelected && (
                <svg
                  className="w-5 h-5 text-indigo-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
