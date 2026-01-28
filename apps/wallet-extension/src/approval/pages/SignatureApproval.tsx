import type { SignatureApprovalRequest } from '../../types'
import { Button, Card, Badge } from '../../ui/components/common'

interface SignatureApprovalProps {
  approval: SignatureApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function SignatureApproval({
  approval,
  onApprove,
  onReject,
}: SignatureApprovalProps) {
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {approval.favicon ? (
              <img
                src={approval.favicon}
                alt=""
                className="w-10 h-10 rounded-lg"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900 break-all">
                {new URL(approval.origin).hostname}
              </p>
              <p className="text-sm text-gray-500">Signature Request</p>
            </div>
          </div>
          {data.riskLevel && (
            <Badge variant={getRiskColor(data.riskLevel)}>
              {data.riskLevel.toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4">
        {/* Signing account */}
        <Card padding="md">
          <p className="text-xs text-gray-500 mb-1">Signing with</p>
          <p className="text-sm font-mono text-gray-900 break-all">
            {data.address}
          </p>
        </Card>

        <Card padding="md">
          <p className="text-xs text-gray-500 mb-2">Message</p>
          <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <pre className="text-sm text-gray-900 whitespace-pre-wrap break-all font-mono">
              {data.displayMessage ?? String(data.message)}
            </pre>
          </div>
        </Card>

        {/* Typed Data (if EIP-712) */}
        {data.typedData !== undefined && (
          <Card padding="md">
            <p className="text-xs text-gray-500 mb-2">Typed Data</p>
            <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs text-gray-900 whitespace-pre-wrap break-all font-mono">
                {JSON.stringify(data.typedData, null, 2)}
              </pre>
            </div>
          </Card>
        )}

        {/* Risk Warnings */}
        {data.riskWarnings && data.riskWarnings.length > 0 && (
          <Card variant="filled" padding="md" className="bg-red-50 border-red-100">
            <p className="text-sm font-medium text-red-800 mb-2">
              Security Warnings
            </p>
            <ul className="space-y-1">
              {data.riskWarnings.map((warning, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-red-700"
                >
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {warning}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 bg-white border-t border-gray-200 space-y-3">
        <Button onClick={() => onApprove()} fullWidth>
          Sign
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          Reject
        </Button>
      </div>
    </div>
  )
}
