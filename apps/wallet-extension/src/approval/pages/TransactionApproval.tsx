import { useTranslation } from 'react-i18next'
import { formatEther, formatUnits } from 'viem'
import type { TransactionApprovalRequest } from '../../types'
import { Badge, Button, Card } from '../../ui/components/common'
import { useNetworkCurrency } from '../../ui/hooks'
import { ApprovalWarnings } from '../components/ApprovalWarnings'
import { TransactionSimulation } from '../components/TransactionSimulation'

/**
 * Convert a value that may be bigint or string (from JSON serialization) to bigint.
 * Chrome extension messaging serializes BigInt as strings.
 */
function toBigInt(value: bigint | string | number | undefined): bigint {
  if (value === undefined) return 0n
  if (typeof value === 'bigint') return value
  return BigInt(value)
}

interface TransactionApprovalProps {
  approval: TransactionApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function TransactionApproval({ approval, onApprove, onReject }: TransactionApprovalProps) {
  const { t } = useTranslation('approval')
  const { t: tc } = useTranslation('common')
  const { data } = approval
  const { symbol: currencySymbol } = useNetworkCurrency()

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'high':
        return 'error'
      case 'medium':
        return 'warning'
      default:
        return 'success'
    }
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const getOriginDisplay = (origin: string) => {
    try {
      return new URL(origin).hostname
    } catch {
      return origin === 'extension' ? 'StableNet Wallet' : origin
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderBottom: '1px solid rgb(var(--border))',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {approval.favicon ? (
              <img src={approval.favicon} alt="" className="w-10 h-10 rounded-lg" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--surface))' }}
              >
                <svg
                  className="w-5 h-5"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </div>
            )}
            <div>
              <p className="font-medium break-all" style={{ color: 'rgb(var(--foreground))' }}>
                {getOriginDisplay(approval.origin)}
              </p>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('txRequestTitle')}
              </p>
            </div>
          </div>
          {data.riskLevel && (
            <Badge variant={getRiskColor(data.riskLevel)}>{data.riskLevel.toUpperCase()}</Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4">
        {/* Transaction Summary */}
        <Card padding="lg" variant="gradient" className="text-center">
          <p className="text-sm opacity-80 mb-1">{data.methodName ?? tc('send')}</p>
          <p className="text-2xl font-bold">
            {formatEther(toBigInt(data.value))} {currencySymbol}
          </p>
        </Card>

        {/* From / To */}
        <Card padding="md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('txFrom')}
              </span>
              <span className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {formatAddress(data.from)}
              </span>
            </div>
            <div className="flex justify-center">
              <svg
                className="w-5 h-5"
                style={{ color: 'rgb(var(--muted-foreground))' }}
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
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('txTo')}
              </span>
              <span className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {formatAddress(data.to)}
              </span>
            </div>
          </div>
        </Card>

        {/* Gas Estimate */}
        {data.estimatedGasCost && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('estimatedGasCost')}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                {t('networkFee')}
              </span>
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                ~{formatEther(toBigInt(data.estimatedGasCost))} {currencySymbol}
              </span>
            </div>
            {data.estimatedTotalCost && (
              <div
                className="flex items-center justify-between mt-2 pt-2"
                style={{ borderTop: '1px solid rgb(var(--border))' }}
              >
                <span
                  className="text-sm font-medium"
                  style={{ color: 'rgb(var(--foreground-secondary))' }}
                >
                  {t('total')}
                </span>
                <span className="text-sm font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                  ~{formatEther(toBigInt(data.estimatedTotalCost))} {currencySymbol}
                </span>
              </div>
            )}
          </Card>
        )}

        {/* Transaction Simulation Results */}
        {data.simulation && <TransactionSimulation simulation={data.simulation} />}

        {/* Contract Interaction (raw data - only show if no decoded calldata) */}
        {data.data && data.data !== '0x' && !data.simulation?.decodedCallData && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('contractData')}
            </p>
            <div
              className="rounded-lg p-3 max-h-24 overflow-y-auto"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              <code
                className="text-xs break-all"
                style={{ color: 'rgb(var(--foreground-secondary))' }}
              >
                {data.data}
              </code>
            </div>
          </Card>
        )}

        {/* Token Transfers */}
        {data.tokenTransfers && data.tokenTransfers.length > 0 && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('tokenTransfers')}
            </p>
            <div className="space-y-2">
              {data.tokenTransfers.map((transfer) => (
                <div
                  key={`${transfer.symbol}-${transfer.direction}-${transfer.amount}`}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{
                    backgroundColor:
                      transfer.direction === 'out'
                        ? 'rgb(var(--destructive) / 0.1)'
                        : 'rgb(var(--success) / 0.1)',
                  }}
                >
                  <span className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {transfer.direction === 'out' ? t('txSend') : t('txReceive')}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{
                      color:
                        transfer.direction === 'out'
                          ? 'rgb(var(--destructive))'
                          : 'rgb(var(--success))',
                    }}
                  >
                    {transfer.direction === 'out' ? '-' : '+'}
                    {formatUnits(toBigInt(transfer.amount), transfer.decimals)}{' '}
                    {transfer.symbol}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Warnings (severity-coded) */}
        <ApprovalWarnings warnings={data.warnings ?? []} riskLevel={data.riskLevel} />
      </div>

      {/* Actions */}
      <div
        className="p-6 space-y-3"
        style={{
          backgroundColor: 'rgb(var(--background-raised))',
          borderTop: '1px solid rgb(var(--border))',
        }}
      >
        <Button onClick={() => onApprove()} fullWidth>
          {tc('confirm')}
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          {tc('reject')}
        </Button>
      </div>
    </div>
  )
}
