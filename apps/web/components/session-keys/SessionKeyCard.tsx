'use client'

import { type FC, useState } from 'react'
import type { Address, Hex } from 'viem'
import { formatUnits } from 'viem'
import { Button } from '../common/Button'
import { cn } from '../../lib/utils'
import type { SessionKeyInfo, SessionKeyState } from '../../hooks/useSessionKey'

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
function formatLimit(amount: bigint, decimals: number = 18): string {
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
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        label: 'Active',
      }
    case 'expired':
      return {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        label: 'Expired',
      }
    case 'revoked':
      return {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        label: 'Revoked',
      }
    default:
      return {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
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
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Key Icon */}
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-gray-600"
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
              <div className="font-mono text-sm text-gray-900">
                {formatAddress(sessionKey.sessionKey)}
              </div>
              <div className="text-xs text-gray-500">
                Created {formatTimestamp(sessionKey.createdAt)}
              </div>
            </div>
          </div>
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium',
              statusStyles.bgColor,
              statusStyles.textColor
            )}
          >
            {statusStyles.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Expiry */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Expires</span>
          <span className="text-gray-900">{formatTimestamp(sessionKey.expiry)}</span>
        </div>

        {/* Spending Limit */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Spending Limit</span>
            <span className="text-gray-900">
              {formatLimit(sessionKey.remainingLimit)} / {formatLimit(sessionKey.totalLimit)}
            </span>
          </div>
          {sessionKey.totalLimit > BigInt(0) && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  remainingPercentage > 50
                    ? 'bg-green-500'
                    : remainingPercentage > 20
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                )}
                style={{ width: `${remainingPercentage}%` }}
              />
            </div>
          )}
        </div>

        {/* Permissions Count */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Permissions</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            {sessionKey.permissions.filter((p) => p.active).length} active
            <svg
              className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded Permissions */}
        {isExpanded && sessionKey.permissions.length > 0 && (
          <div className="mt-2 space-y-2 pt-2 border-t border-gray-100">
            {sessionKey.permissions.map((perm, idx) => (
              <div
                key={`${perm.target}-${perm.selector}-${idx}`}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      perm.active ? 'bg-green-500' : 'bg-gray-300'
                    )}
                  />
                  <span className="font-mono text-gray-600">{formatAddress(perm.target)}</span>
                </div>
                <span className="font-mono text-gray-400">{perm.selector}</span>
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
