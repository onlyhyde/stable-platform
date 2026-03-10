import { useTranslation } from 'react-i18next'
import type { SignatureApprovalRequest } from '../../types'
import { Badge, Button, Card } from '../../ui/components/common'

interface SignatureApprovalProps {
  approval: SignatureApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

/**
 * Detect whether the typed data represents an EIP-4337 PackedUserOperation.
 */
function isUserOpTypedData(typedData: unknown): typedData is {
  primaryType: 'PackedUserOperation'
  domain: { name: string; version: string; chainId: string; verifyingContract: string }
  types: Record<string, Array<{ name: string; type: string }>>
  message: Record<string, string>
} {
  if (!typedData || typeof typedData !== 'object') return false
  const td = typedData as Record<string, unknown>
  return td.primaryType === 'PackedUserOperation'
}

/**
 * Human-readable labels for PackedUserOperation fields.
 */
const USER_OP_FIELD_LABELS: Record<string, string> = {
  sender: 'Sender',
  nonce: 'Nonce',
  initCode: 'Init Code',
  callData: 'Call Data',
  accountGasLimits: 'Account Gas Limits',
  preVerificationGas: 'Pre-Verification Gas',
  gasFees: 'Gas Fees',
  paymasterAndData: 'Paymaster & Data',
}

/**
 * Truncate long hex strings for display, keeping head and tail visible.
 */
function truncateHex(value: string, maxLen = 42): string {
  if (value.length <= maxLen) return value
  return `${value.slice(0, 22)}...${value.slice(-16)}`
}

export function SignatureApproval({ approval, onApprove, onReject }: SignatureApprovalProps) {
  const { t } = useTranslation('approval')
  const { t: tc } = useTranslation('common')
  const { data } = approval

  const isUserOp = isUserOpTypedData(data.typedData)
  const isEip712 = data.method === 'eth_signTypedData_v4'
  // Narrowed typed data reference after type guard
  const userOpTypedData = isUserOp
    ? (data.typedData as {
        domain: Record<string, string>
        message: Record<string, string>
      })
    : null

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
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {/* Signing account */}
        <Card padding="md">
          <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {t('signingWith')}
          </p>
          <p className="text-sm font-mono break-all" style={{ color: 'rgb(var(--foreground))' }}>
            {data.address}
          </p>
        </Card>

        {/* EIP Standard indicator */}
        {isUserOp && (
          <Card padding="md">
            <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('signingStandard')}
            </p>
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {isEip712 ? t('eip712Label') : t('eip191Label')}
            </p>
            <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {isEip712 ? t('userOpTypedDataDesc') : t('userOpHashDesc')}
            </p>
          </Card>
        )}

        {/* EIP-191 message (personal_sign) */}
        {(data.displayMessage || data.message) && !isUserOp && (
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

        {/* UserOp EIP-191 hash display */}
        {data.message && isUserOp && !isEip712 && (
          <Card padding="md">
            <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              UserOperation Hash
            </p>
            <div
              className="rounded-lg p-3 overflow-x-auto"
              style={{ backgroundColor: 'rgb(var(--surface))' }}
            >
              <code
                className="text-xs break-all font-mono"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {String(data.message)}
              </code>
            </div>
          </Card>
        )}

        {/* UserOp EIP-712 structured display */}
        {isUserOp && isEip712 && (
          <>
            {/* Domain */}
            <Card padding="md">
              <p
                className="text-xs font-medium mb-2"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                EIP-712 Domain
              </p>
              <div className="space-y-2">
                {Object.entries(userOpTypedData!.domain).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2">
                    <span
                      className="text-xs shrink-0"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {key}
                    </span>
                    <span
                      className="text-xs font-mono text-right break-all"
                      style={{ color: 'rgb(var(--foreground))' }}
                    >
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Message fields */}
            <Card padding="md">
              <p
                className="text-xs font-medium mb-2"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                PackedUserOperation
              </p>
              <div className="space-y-3">
                {Object.entries(userOpTypedData!.message).map(([key, value]) => {
                  const strValue = String(value)
                  const label = USER_OP_FIELD_LABELS[key] ?? key
                  const isLongHex = strValue.startsWith('0x') && strValue.length > 42

                  return (
                    <div key={key}>
                      <p
                        className="text-xs mb-0.5"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {label}
                      </p>
                      {isLongHex ? (
                        <div
                          className="rounded p-2 overflow-x-auto"
                          style={{ backgroundColor: 'rgb(var(--surface))' }}
                        >
                          <code
                            className="text-xs break-all font-mono"
                            style={{ color: 'rgb(var(--foreground))' }}
                            title={strValue}
                          >
                            {truncateHex(strValue, 66)}
                          </code>
                        </div>
                      ) : (
                        <p
                          className="text-xs font-mono break-all"
                          style={{ color: 'rgb(var(--foreground))' }}
                        >
                          {strValue}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </>
        )}

        {/* Generic Typed Data (non-UserOp EIP-712) */}
        {data.typedData !== undefined && !isUserOp && (
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
