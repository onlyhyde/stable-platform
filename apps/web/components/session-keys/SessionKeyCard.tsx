'use client'

import { type FC, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import type { SessionKeyInfo, SessionKeyState } from '../../hooks/useSessionKey'
import { cn } from '../../lib/utils'
import { Button } from '../common/Button'

interface SessionKeyCardProps {
  sessionKey: SessionKeyInfo
  onRevoke?: (sessionKey: Address) => Promise<void>
  onViewDetails?: (sessionKey: SessionKeyInfo) => void
  isRevoking?: boolean
}

// Format address for display
function formatAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Format timestamp
function formatTimestamp(timestamp: bigint): string {
  if (timestamp === BigInt(0)) return 'No expiry'
  const date = new Date(Number(timestamp) * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format spending limit
function formatLimit(amount: bigint, decimals = 18): string {
  if (amount === BigInt(0)) return 'Unlimited'
  return `${formatUnits(amount, decimals)} ETH`
}

// Get status badge styles
function getStatusStyles(state: SessionKeyState): {
  bgColor: string
  textColor: string
  label: string
} {
  switch (state) {
    case 'active':
      return {
        bgColor: 'rgb(var(--success) / 0.1)',
        textColor: 'rgb(var(--success))',
        label: 'Active',
      }
    case 'expired':
      return {
        bgColor: 'rgb(var(--warning) / 0.1)',
        textColor: 'rgb(var(--warning))',
        label: 'Expired',
      }
    case 'revoked':
      return {
        bgColor: 'rgb(var(--destructive) / 0.1)',
        textColor: 'rgb(var(--destructive))',
        label: 'Revoked',
      }
    default:
      return {
        bgColor: 'rgb(var(--secondary))',
        textColor: 'rgb(var(--muted-foreground))',
        label: 'Unknown',
      }
  }
}

export const SessionKeyCard: FC<SessionKeyCardProps> = ({
  sessionKey,
  onRevoke,
  onViewDetails,
  isRevoking = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const statusStyles = getStatusStyles(sessionKey.state)

  const handleRevoke = async () => {
    if (onRevoke) {
      await onRevoke(sessionKey.sessionKey)
    }
  }

  const remainingPercentage =
    sessionKey.totalLimit > BigInt(0)
      ? Number((sessionKey.remainingLimit * BigInt(100)) / sessionKey.totalLimit)
      : 100

  return (
    <div
      className="rounded-lg border shadow-sm overflow-hidden"
      style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border) / 0.5)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Key Icon */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                style={{ color: 'rgb(var(--muted-foreground))' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <div>
              <div className="font-mono text-sm" style={{ color: 'rgb(var(--foreground))' }}>
                {formatAddress(sessionKey.sessionKey)}
              </div>
              <div className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Created {formatTimestamp(sessionKey.createdAt)}
              </div>
            </div>
          </div>
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: statusStyles.bgColor, color: statusStyles.textColor }}
          >
            {statusStyles.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Expiry */}
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>Expires</span>
          <span style={{ color: 'rgb(var(--foreground))' }}>
            {formatTimestamp(sessionKey.expiry)}
          </span>
        </div>

        {/* Spending Limit */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-sm">
            <span style={{ color: 'rgb(var(--muted-foreground))' }}>Spending Limit</span>
            <span style={{ color: 'rgb(var(--foreground))' }}>
              {formatLimit(sessionKey.remainingLimit)} / {formatLimit(sessionKey.totalLimit)}
            </span>
          </div>
          {sessionKey.totalLimit > BigInt(0) && (
            <div
              className="w-full rounded-full h-2"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${remainingPercentage}%`,
                  backgroundColor:
                    remainingPercentage > 50
                      ? 'rgb(var(--success))'
                      : remainingPercentage > 20
                        ? 'rgb(var(--warning))'
                        : 'rgb(var(--destructive))',
                }}
              />
            </div>
          )}
        </div>

        {/* Permissions Count */}
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>Permissions</span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="font-medium flex items-center gap-1 hover:opacity-80"
            style={{ color: 'rgb(var(--primary))' }}
          >
            {sessionKey.permissions.filter((p) => p.active).length} active
            <svg
              aria-hidden="true"
              className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Expanded Permissions */}
        {isExpanded && sessionKey.permissions.length > 0 && (
          <div
            className="mt-2 space-y-2 pt-2 border-t"
            style={{ borderColor: 'rgb(var(--border) / 0.5)' }}
          >
            {sessionKey.permissions.map((perm, idx) => (
              <div
                key={`${perm.target}-${perm.selector}-${idx}`}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: perm.active
                        ? 'rgb(var(--success))'
                        : 'rgb(var(--muted-foreground) / 0.3)',
                    }}
                  />
                  <span className="font-mono" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {formatAddress(perm.target)}
                  </span>
                </div>
                <span className="font-mono" style={{ color: 'rgb(var(--muted-foreground) / 0.6)' }}>
                  {perm.selector}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {sessionKey.state === 'active' && (
        <div className="px-4 pb-4 flex gap-2">
          {onViewDetails && (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => onViewDetails(sessionKey)}
            >
              View Details
            </Button>
          )}
          {onRevoke && (
            <Button
              variant="danger"
              size="sm"
              className="flex-1"
              onClick={handleRevoke}
              isLoading={isRevoking}
            >
              Revoke
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default SessionKeyCard
