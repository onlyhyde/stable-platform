import { useTranslation } from 'react-i18next'
import { Badge, Card } from '../../ui/components/common'

interface SimulationProps {
  simulation: {
    success: boolean
    revertReason?: string
    decodedCallData?: {
      functionName: string
      selector: string
      args: Array<{ name: string; type: string; value: string }>
      description: string
    }
    balanceChanges?: Array<{
      asset: string
      symbol: string
      amount: string
      direction: 'in' | 'out'
    }>
  }
}

function formatAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function TransactionSimulation({ simulation }: SimulationProps) {
  const { t } = useTranslation('approval')
  const { success, revertReason, decodedCallData, balanceChanges } = simulation

  return (
    <div className="space-y-3">
      {/* Simulation Status */}
      {!success && (
        <Card
          variant="filled"
          padding="md"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            border: '1px solid rgb(var(--destructive) / 0.2)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <svg
              className="w-4 h-4 shrink-0"
              style={{ color: 'rgb(var(--destructive))' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--destructive))' }}>
              {t('simulationFailed')}
            </p>
          </div>
          {revertReason && (
            <p className="text-xs ml-6" style={{ color: 'rgb(var(--destructive) / 0.8)' }}>
              {revertReason}
            </p>
          )}
        </Card>
      )}

      {/* Decoded Function Call */}
      {decodedCallData && decodedCallData.functionName !== 'unknown' && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('functionCall')}
            </p>
            <Badge variant="default">{decodedCallData.functionName}</Badge>
          </div>
          <p className="text-sm mb-2" style={{ color: 'rgb(var(--foreground-secondary))' }}>
            {decodedCallData.description}
          </p>
          {decodedCallData.args.length > 0 && (
            <div
              className="rounded-lg p-2 space-y-1"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              {decodedCallData.args.map((arg) => (
                <div key={arg.name} className="flex items-center justify-between text-xs">
                  <span style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {arg.name}
                    <span className="opacity-50 ml-1">({arg.type})</span>
                  </span>
                  <span
                    className="font-mono ml-2 truncate max-w-[180px]"
                    style={{
                      color:
                        arg.value === 'UNLIMITED'
                          ? 'rgb(var(--destructive))'
                          : 'rgb(var(--foreground))',
                    }}
                    title={arg.value}
                  >
                    {arg.type === 'address' ? formatAddress(arg.value) : arg.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Balance Changes */}
      {balanceChanges && balanceChanges.length > 0 && (
        <Card padding="md">
          <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('expectedBalanceChanges')}
          </p>
          <div className="space-y-1">
            {balanceChanges.map((change) => (
              <div
                key={`${change.asset}-${change.direction}-${change.amount}`}
                className="flex items-center justify-between p-2 rounded-lg"
                style={{
                  backgroundColor:
                    change.direction === 'out'
                      ? 'rgb(var(--destructive) / 0.1)'
                      : 'rgb(var(--success) / 0.1)',
                }}
              >
                <span className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
                  {change.symbol}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{
                    color:
                      change.direction === 'out'
                        ? 'rgb(var(--destructive))'
                        : 'rgb(var(--success))',
                  }}
                >
                  {change.direction === 'out' ? '-' : '+'}
                  {change.amount} {change.symbol}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Unknown Function Warning */}
      {decodedCallData && decodedCallData.functionName === 'unknown' && (
        <Card
          variant="filled"
          padding="md"
          style={{
            backgroundColor: 'rgb(var(--warning) / 0.1)',
            border: '1px solid rgb(var(--warning) / 0.2)',
          }}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 shrink-0"
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
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: 'rgb(234 179 8)' }}>
                {t('unknownFunction')}
              </p>
              <p className="text-xs" style={{ color: 'rgb(var(--warning) / 0.8)' }}>
                {t('selector', { selector: decodedCallData.selector })}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
