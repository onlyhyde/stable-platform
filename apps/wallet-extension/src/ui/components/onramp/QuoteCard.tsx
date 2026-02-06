import type { OnRampQuote } from '../../../types'
import { Badge, Card } from '../common'

interface QuoteCardProps {
  quote: OnRampQuote
  onAccept?: () => void
  isExpired?: boolean
}

export function QuoteCard({ quote, onAccept, isExpired = false }: QuoteCardProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatCrypto = (amount: string, symbol: string) => {
    return `${Number.parseFloat(amount).toFixed(6)} ${symbol}`
  }

  const getTimeRemaining = () => {
    const expiresAt = new Date(quote.expiresAt).getTime()
    const now = Date.now()
    const diff = expiresAt - now
    if (diff <= 0) return 'Expired'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <Card padding="lg" variant={isExpired ? 'filled' : 'outline'}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Price Quote</h3>
        {isExpired ? (
          <Badge variant="error" size="sm">
            Expired
          </Badge>
        ) : (
          <Badge variant="warning" size="sm">
            {getTimeRemaining()}
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">You pay</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(quote.fiatAmount, quote.fiatCurrency)}
          </span>
        </div>

        <div className="flex justify-center">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">You receive</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCrypto(quote.cryptoAmount, quote.cryptoCurrency)}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Exchange Rate</span>
          <span className="text-gray-700">
            1 {quote.cryptoCurrency} = {formatCurrency(1 / quote.exchangeRate, quote.fiatCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Network Fee</span>
          <span className="text-gray-700">
            {formatCurrency(quote.fees.networkFee, quote.fiatCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Service Fee</span>
          <span className="text-gray-700">
            {formatCurrency(quote.fees.serviceFee, quote.fiatCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-gray-700">Total</span>
          <span className="text-gray-900">
            {formatCurrency(quote.totalFiatAmount, quote.fiatCurrency)}
          </span>
        </div>
      </div>

      {onAccept && !isExpired && (
        <button
          type="button"
          onClick={onAccept}
          className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          Accept Quote
        </button>
      )}
    </Card>
  )
}
