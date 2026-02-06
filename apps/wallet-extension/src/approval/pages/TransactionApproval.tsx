import { formatEther } from 'viem'
import type { TransactionApprovalRequest } from '../../types'
import { Badge, Button, Card } from '../../ui/components/common'
import { useNetworkCurrency } from '../../ui/hooks'

interface TransactionApprovalProps {
  approval: TransactionApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function TransactionApproval({ approval, onApprove, onReject }: TransactionApprovalProps) {
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
                {new URL(approval.origin).hostname}
              </p>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Transaction Request
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
          <p className="text-sm opacity-80 mb-1">{data.methodName ?? 'Send'}</p>
          <p className="text-2xl font-bold">
            {formatEther(data.value)} {currencySymbol}
          </p>
        </Card>

        {/* From / To */}
        <Card padding="md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                From
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
                To
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
              Estimated Gas Cost
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                Network Fee
              </span>
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                ~{formatEther(data.estimatedGasCost)} {currencySymbol}
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
                  Total
                </span>
                <span className="text-sm font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                  ~{formatEther(data.estimatedTotalCost)} {currencySymbol}
                </span>
              </div>
            )}
          </Card>
        )}

        {/* Contract Interaction */}
        {data.data && data.data !== '0x' && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Contract Data
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
              Token Transfers
            </p>
            <div className="space-y-2">
              {data.tokenTransfers.map((transfer, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{
                    backgroundColor:
                      transfer.direction === 'out'
                        ? 'rgb(var(--destructive) / 0.1)'
                        : 'rgb(var(--success) / 0.1)',
                  }}
                >
                  <span className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                    {transfer.direction === 'out' ? 'Send' : 'Receive'}
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
                    {(Number(transfer.amount) / 10 ** transfer.decimals).toFixed(4)}{' '}
                    {transfer.symbol}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Warnings */}
        {data.warnings && data.warnings.length > 0 && (
          <Card
            variant="filled"
            padding="md"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              border: '1px solid rgb(var(--warning) / 0.2)',
            }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: 'rgb(234 179 8)' }}>
              Warnings
            </p>
            <ul className="space-y-1">
              {data.warnings.map((warning, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: 'rgb(var(--warning) / 0.8)' }}
                >
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: 'rgb(var(--warning))' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  {warning}
                </li>
              ))}
            </ul>
          </Card>
        )}
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
          Confirm
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          Reject
        </Button>
      </div>
    </div>
  )
}
