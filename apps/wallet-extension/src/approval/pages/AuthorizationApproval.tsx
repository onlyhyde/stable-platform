import { useTranslation } from 'react-i18next'
import type { AuthorizationApprovalRequest } from '../../types'
import { Badge, Button, Card } from '../../ui/components/common'

interface AuthorizationApprovalProps {
  approval: AuthorizationApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function AuthorizationApproval({
  approval,
  onApprove,
  onReject,
}: AuthorizationApprovalProps) {
  const { t } = useTranslation('approval')
  const { t: tc } = useTranslation('common')
  const { data } = approval

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'error'
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
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
            )}
            <div>
              <p className="font-medium break-all" style={{ color: 'rgb(var(--foreground))' }}>
                {getOriginDisplay(approval.origin)}
              </p>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {data.isRevocation ? t('accountRevocation') : t('accountAuthorization')}
              </p>
            </div>
          </div>
          <Badge variant={getRiskColor(data.riskLevel)}>{data.riskLevel.toUpperCase()}</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {/* EIP-7702 Explanation */}
        <Card
          variant="filled"
          padding="md"
          style={{
            backgroundColor: data.isRevocation
              ? 'rgb(var(--success) / 0.1)'
              : 'rgb(var(--primary) / 0.1)',
            border: data.isRevocation
              ? '1px solid rgb(var(--success) / 0.2)'
              : '1px solid rgb(var(--primary) / 0.2)',
          }}
        >
          <p
            className="text-sm font-medium mb-2"
            style={{ color: data.isRevocation ? 'rgb(var(--success))' : 'rgb(var(--primary))' }}
          >
            {data.isRevocation ? t('revokeSmartAccountTitle') : t('eip7702AuthTitle')}
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
            {data.isRevocation ? t('revokeSmartAccountDesc') : t('eip7702AuthDesc')}
          </p>
        </Card>

        {/* Account being authorized */}
        <Card padding="md">
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {data.isRevocation ? t('accountToRevoke') : t('accountToAuthorize')}
          </p>
          <p className="text-sm font-mono break-all" style={{ color: 'rgb(var(--foreground))' }}>
            {data.account}
          </p>
        </Card>

        {/* Contract being delegated to */}
        {!data.isRevocation && (
          <Card padding="md">
            <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('delegateToContract')}
            </p>
            <p className="text-sm font-mono break-all" style={{ color: 'rgb(var(--foreground))' }}>
              {data.contractAddress}
            </p>
            {data.contractInfo && (
              <div
                className="mt-3 p-3 rounded-lg"
                style={{ backgroundColor: 'rgb(var(--surface))' }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: 'rgb(var(--foreground))' }}>
                  {data.contractInfo.name}
                </p>
                <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {data.contractInfo.description}
                </p>
                {data.contractInfo.features.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {data.contractInfo.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'rgb(var(--primary) / 0.1)',
                          color: 'rgb(var(--primary))',
                        }}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Chain & Nonce Info */}
        <Card padding="md">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('chainId')}
              </p>
              <p className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {data.chainId}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('authorizationNonce')}
              </p>
              <p className="text-sm font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {String(data.nonce)}
              </p>
            </div>
          </div>
        </Card>

        {/* Risk Warnings */}
        {data.warnings && data.warnings.length > 0 && (
          <Card
            variant="filled"
            padding="md"
            style={{
              backgroundColor:
                data.riskLevel === 'critical' || data.riskLevel === 'high'
                  ? 'rgb(var(--destructive) / 0.1)'
                  : 'rgb(var(--warning) / 0.1)',
              border:
                data.riskLevel === 'critical' || data.riskLevel === 'high'
                  ? '1px solid rgb(var(--destructive) / 0.2)'
                  : '1px solid rgb(var(--warning) / 0.2)',
            }}
          >
            <p
              className="text-sm font-medium mb-2"
              style={{
                color:
                  data.riskLevel === 'critical' || data.riskLevel === 'high'
                    ? 'rgb(var(--destructive))'
                    : 'rgb(var(--warning))',
              }}
            >
              {t('securityWarnings')}
            </p>
            <ul className="space-y-1">
              {data.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 text-sm"
                  style={{
                    color:
                      data.riskLevel === 'critical' || data.riskLevel === 'high'
                        ? 'rgb(var(--destructive) / 0.8)'
                        : 'rgb(var(--warning) / 0.8)',
                  }}
                >
                  <svg
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{
                      color:
                        data.riskLevel === 'critical' || data.riskLevel === 'high'
                          ? 'rgb(var(--destructive))'
                          : 'rgb(var(--warning))',
                    }}
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

        {/* Critical Warning for High Risk */}
        {(data.riskLevel === 'critical' || data.riskLevel === 'high') && !data.isRevocation && (
          <Card
            variant="filled"
            padding="md"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.15)',
              border: '2px solid rgb(var(--destructive))',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5"
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
              <p className="text-sm font-bold" style={{ color: 'rgb(var(--destructive))' }}>
                {t('criticalWarningTitle')}
              </p>
            </div>
            <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
              {t('criticalWarningDesc')}
            </p>
            <ul className="mt-2 space-y-1 text-sm" style={{ color: 'rgb(var(--destructive))' }}>
              <li>• {t('criticalWarningAccess')}</li>
              <li>• {t('criticalWarningExecute')}</li>
              <li>• {t('criticalWarningDrain')}</li>
            </ul>
            <p className="text-sm font-medium mt-2" style={{ color: 'rgb(var(--destructive))' }}>
              {t('criticalWarningAdvice')}
            </p>
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
        <Button
          onClick={() => onApprove()}
          fullWidth
          variant={data.riskLevel === 'critical' ? 'secondary' : 'primary'}
        >
          {data.isRevocation ? t('revokeAuthorization') : t('authorize')}
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          {tc('reject')}
        </Button>
      </div>
    </div>
  )
}
