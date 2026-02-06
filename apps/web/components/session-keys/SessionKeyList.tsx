'use client'

import { type FC, useState } from 'react'
import type { Address } from 'viem'
import type { SessionKeyInfo, UseSessionKeyReturn } from '../../hooks/useSessionKey'
import { Button } from '../common/Button'
import { CreateSessionKeyModal } from './CreateSessionKeyModal'
import { SessionKeyCard } from './SessionKeyCard'

interface SessionKeyListProps {
  sessionKeys: SessionKeyInfo[]
  isLoading: boolean
  error: string | null
  onCreateSessionKey: UseSessionKeyReturn['createSessionKey']
  onRevokeSessionKey: UseSessionKeyReturn['revokeSessionKey']
  onRefresh: () => Promise<void>
  isCreating: boolean
  isRevoking: boolean
}

export const SessionKeyList: FC<SessionKeyListProps> = ({
  sessionKeys,
  isLoading,
  error,
  onCreateSessionKey,
  onRevokeSessionKey,
  onRefresh,
  isCreating,
  isRevoking,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [_selectedKey, setSelectedKey] = useState<SessionKeyInfo | null>(null)
  const [revokingKey, setRevokingKey] = useState<Address | null>(null)

  const handleRevoke = async (sessionKey: Address) => {
    setRevokingKey(sessionKey)
    try {
      await onRevokeSessionKey(sessionKey)
    } finally {
      setRevokingKey(null)
    }
  }

  const handleViewDetails = (sessionKey: SessionKeyInfo) => {
    setSelectedKey(sessionKey)
    // In a full implementation, this would open a details modal
  }

  const activeKeys = sessionKeys.filter((k) => k.state === 'active')
  const inactiveKeys = sessionKeys.filter((k) => k.state !== 'active')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            Session Keys
          </h2>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Manage session keys for delegated transaction signing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} isLoading={isLoading}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Key
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderWidth: '1px',
            borderColor: 'rgb(var(--destructive) / 0.2)',
            color: 'rgb(var(--destructive))',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && sessionKeys.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2"
            style={{ borderColor: 'rgb(var(--primary))' }}
          />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessionKeys.length === 0 && (
        <div
          className="text-center py-12 rounded-lg border-2 border-dashed"
          style={{ backgroundColor: 'rgb(var(--secondary))', borderColor: 'rgb(var(--border))' }}
        >
          <svg
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: 'rgb(var(--muted-foreground))' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <h3 className="text-sm font-medium mb-1" style={{ color: 'rgb(var(--foreground))' }}>
            No session keys
          </h3>
          <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Create a session key to delegate transaction signing
          </p>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            Create Session Key
          </Button>
        </div>
      )}

      {/* Active Keys */}
      {activeKeys.length > 0 && (
        <div>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            Active ({activeKeys.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeKeys.map((sessionKey) => (
              <SessionKeyCard
                key={sessionKey.sessionKey}
                sessionKey={sessionKey}
                onRevoke={handleRevoke}
                onViewDetails={handleViewDetails}
                isRevoking={isRevoking && revokingKey === sessionKey.sessionKey}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Keys */}
      {inactiveKeys.length > 0 && (
        <div>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            Inactive ({inactiveKeys.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {inactiveKeys.map((sessionKey) => (
              <SessionKeyCard
                key={sessionKey.sessionKey}
                sessionKey={sessionKey}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateSessionKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={onCreateSessionKey}
        isCreating={isCreating}
      />
    </div>
  )
}

export default SessionKeyList
