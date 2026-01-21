import { formatEther } from 'viem'
import type { TransactionApprovalRequest } from '../../types'
import { Button, Card, Badge } from '../../ui/components/common'

interface TransactionApprovalProps {
  approval: TransactionApprovalRequest
  onApprove: (data?: unknown) => void
  onReject: () => void
}

export function TransactionApproval({
  approval,
  onApprove,
  onReject,
}: TransactionApprovalProps) {
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

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

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
              <p className="text-sm text-gray-500">Transaction Request</p>
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
        {/* Transaction Summary */}
        <Card padding="lg" variant="gradient" className="text-center">
          <p className="text-sm opacity-80 mb-1">
            {data.methodName ?? 'Send'}
          </p>
          <p className="text-2xl font-bold">
            {formatEther(data.value)} ETH
          </p>
        </Card>

        {/* From / To */}
        <Card padding="md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">From</span>
              <span className="text-sm font-mono text-gray-900">
                {formatAddress(data.from)}
              </span>
            </div>
            <div className="flex justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">To</span>
              <span className="text-sm font-mono text-gray-900">
                {formatAddress(data.to)}
              </span>
            </div>
          </div>
        </Card>

        {/* Gas Estimate */}
        {data.estimatedGasCost && (
          <Card padding="md">
            <p className="text-xs text-gray-500 mb-2">Estimated Gas Cost</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Network Fee</span>
              <span className="text-sm font-medium text-gray-900">
                ~{formatEther(data.estimatedGasCost)} ETH
              </span>
            </div>
            {data.estimatedTotalCost && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">Total</span>
                <span className="text-sm font-bold text-gray-900">
                  ~{formatEther(data.estimatedTotalCost)} ETH
                </span>
              </div>
            )}
          </Card>
        )}

        {/* Contract Interaction */}
        {data.data && data.data !== '0x' && (
          <Card padding="md">
            <p className="text-xs text-gray-500 mb-2">Contract Data</p>
            <div className="bg-gray-50 rounded-lg p-3 max-h-24 overflow-y-auto">
              <code className="text-xs text-gray-700 break-all">
                {data.data}
              </code>
            </div>
          </Card>
        )}

        {/* Token Transfers */}
        {data.tokenTransfers && data.tokenTransfers.length > 0 && (
          <Card padding="md">
            <p className="text-xs text-gray-500 mb-2">Token Transfers</p>
            <div className="space-y-2">
              {data.tokenTransfers.map((transfer, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    transfer.direction === 'out' ? 'bg-red-50' : 'bg-green-50'
                  }`}
                >
                  <span className="text-sm text-gray-700">
                    {transfer.direction === 'out' ? 'Send' : 'Receive'}
                  </span>
                  <span className={`text-sm font-medium ${
                    transfer.direction === 'out' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {transfer.direction === 'out' ? '-' : '+'}
                    {(Number(transfer.amount) / 10 ** transfer.decimals).toFixed(4)} {transfer.symbol}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Warnings */}
        {data.warnings && data.warnings.length > 0 && (
          <Card variant="filled" padding="md" className="bg-amber-50 border-amber-100">
            <p className="text-sm font-medium text-amber-800 mb-2">
              Warnings
            </p>
            <ul className="space-y-1">
              {data.warnings.map((warning, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-amber-700"
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
          Confirm
        </Button>
        <Button onClick={onReject} variant="secondary" fullWidth>
          Reject
        </Button>
      </div>
    </div>
  )
}
