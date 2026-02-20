import { formatUnits } from 'viem'

export interface TokenAmountProps {
  amount: bigint
  decimals?: number
  /** Native currency symbol - must be provided by the caller */
  symbol: string
  showSymbol?: boolean
  showUsd?: boolean
  usdPrice?: number
  maxDecimals?: number
  className?: string
}

export function TokenAmount({
  amount,
  decimals = 18,
  symbol,
  showSymbol = true,
  showUsd = false,
  usdPrice,
  maxDecimals = 6,
  className = '',
}: TokenAmountProps) {
  const formatted = formatUnits(amount, decimals)
  const numValue = Number.parseFloat(formatted)

  // Format with max decimals, removing trailing zeros
  const displayValue = numValue.toFixed(maxDecimals).replace(/\.?0+$/, '')

  // Calculate USD value if price is provided
  const usdValue = showUsd && usdPrice ? numValue * usdPrice : null

  return (
    <span className={className}>
      <span className="font-medium">
        {displayValue}
        {showSymbol && ` ${symbol}`}
      </span>
      {usdValue !== null && (
        <span className="text-gray-500 text-sm ml-1">(${usdValue.toFixed(2)})</span>
      )}
    </span>
  )
}

export interface TokenDisplayProps {
  symbol: string
  name?: string
  icon?: string
  amount?: bigint
  decimals?: number
  usdValue?: number
  className?: string
}

export function TokenDisplay({
  symbol,
  name,
  icon,
  amount,
  decimals = 18,
  usdValue,
  className = '',
}: TokenDisplayProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Token Icon */}
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
        {icon ? (
          <img src={icon} alt={symbol} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-gray-500">{symbol.slice(0, 2)}</span>
        )}
      </div>

      {/* Token Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">{symbol}</span>
          {amount !== undefined && (
            <TokenAmount
              amount={amount}
              decimals={decimals}
              symbol={symbol}
              showSymbol={false}
              className="text-gray-900"
            />
          )}
        </div>
        <div className="flex items-center justify-between">
          {name && <span className="text-sm text-gray-500 truncate">{name}</span>}
          {usdValue !== undefined && (
            <span className="text-sm text-gray-500">${usdValue.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  /** Native currency symbol - must be provided by the caller */
  symbol: string
  max?: bigint
  decimals?: number
  usdPrice?: number
  error?: string
  disabled?: boolean
}

export function AmountInput({
  value,
  onChange,
  symbol,
  max,
  decimals = 18,
  usdPrice,
  error,
  disabled = false,
}: AmountInputProps) {
  const numValue = Number.parseFloat(value) || 0
  const usdValue = usdPrice ? numValue * usdPrice : null

  const handleMax = () => {
    if (max) {
      onChange(formatUnits(max, decimals))
    }
  }

  return (
    <div className="w-full">
      <div
        className={`
          flex items-center gap-2 p-4 rounded-xl border
          ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}
          ${disabled ? 'opacity-60' : ''}
        `}
      >
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0"
          disabled={disabled}
          className="flex-1 text-2xl font-medium bg-transparent outline-none"
        />
        <div className="flex items-center gap-2">
          {max && (
            <button
              type="button"
              onClick={handleMax}
              disabled={disabled}
              className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-50"
            >
              MAX
            </button>
          )}
          <span className="font-medium text-gray-700">{symbol}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 px-1">
        {usdValue !== null && (
          <span className="text-sm text-gray-500">≈ ${usdValue.toFixed(2)}</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
