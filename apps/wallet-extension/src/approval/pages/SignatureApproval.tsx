import { useTranslation } from 'react-i18next'
import type { SignatureApprovalRequest } from '../../types'
import { Badge, Button, Card } from '../../ui/components/common'

interface SignatureApprovalProps {
  approval: SignatureApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function SignatureApproval({ approval, onApprove, onReject }: SignatureApprovalProps) {
  const { t } = useTranslation('approval')
  const { t: tc } = useTranslation('common')
  const { data } = approval

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
                {t('signatureRequest')}
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
        {/* Signing account */}
        <Card padding="md">
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('signingWith')}
          </p>
          <p className="text-sm font-mono break-all" style={{ color: 'rgb(var(--foreground))' }}>
            {data.address}
          </p>
        </Card>

        {(data.displayMessage || data.message) && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('message')}
            </p>
            <div
              className="rounded-lg p-3 max-h-48 overflow-y-auto"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              <pre
                className="text-sm whitespace-pre-wrap break-all font-mono"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {data.displayMessage || String(data.message)}
              </pre>
            </div>
          </Card>
        )}

        {/* Typed Data (if EIP-712) */}
        {data.typedData !== undefined && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('typedData')}
            </p>
            <div
              className="rounded-lg p-3 max-h-48 overflow-y-auto"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              <pre
                className="text-xs whitespace-pre-wrap break-all font-mono"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {JSON.stringify(data.typedData, null, 2)}
              </pre>
            </div>
          </Card>
        )}

        {/* Risk Warnings */}
        {data.riskWarnings && data.riskWarnings.length > 0 && (
          <Card
            variant="filled"
            padding="md"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              border: '1px solid rgb(var(--destructive) / 0.2)',
            }}
          >
            <p className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--destructive))' }}>
              {t('securityWarnings')}
            </p>
            <ul className="space-y-1">
              {data.riskWarnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: 'rgb(var(--destructive) / 0.8)' }}
                >
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
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
          {t('sign')}
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          {tc('reject')}
        </Button>
      </div>
    </div>
  )
}
