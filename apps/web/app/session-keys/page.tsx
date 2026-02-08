'use client'

import { SessionKeyList } from '../../components/session-keys'
import { useSessionKey } from '../../hooks/useSessionKey'
import { useWallet } from '../../hooks/useWallet'

export default function SessionKeysPage() {
  const { isConnected, address: _address } = useWallet()
  const {
    sessionKeys,
    isLoading,
    error,
    isCreating,
    isRevoking,
    createSessionKey,
    revokeSessionKey,
    refresh,
    clearError: _clearError,
  } = useSessionKey()

  if (!isConnected) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'rgb(var(--background))' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center py-20">
            <svg
              className="w-16 h-16 mx-auto mb-4"
              style={{ color: 'rgb(var(--muted-foreground))' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              Connect Your Wallet
            </h2>
            <p className="max-w-md mx-auto" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Please connect your wallet to manage session keys for your account.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgb(var(--background))' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
            Session Key Management
          </h1>
          <p className="mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Create and manage session keys for delegated transaction signing (ERC-7715)
          </p>
        </div>

        {/* Info Banner */}
        <div
          className="rounded-lg p-4 mb-8 border"
          style={{
            backgroundColor: 'rgb(var(--info) / 0.1)',
            borderColor: 'rgb(var(--info) / 0.3)',
          }}
        >
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: 'rgb(var(--info))' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="font-medium" style={{ color: 'rgb(var(--info))' }}>
                What are Session Keys?
              </h3>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                Session keys are temporary keys that can sign transactions on behalf of your
                account. They&apos;re useful for dApps that need to perform multiple transactions
                without requiring your signature each time. You can set expiry times, spending
                limits, and restrict which contracts they can interact with.
              </p>
            </div>
          </div>
        </div>

        {/* Session Key List */}
        <SessionKeyList
          sessionKeys={sessionKeys}
          isLoading={isLoading}
          error={error}
          onCreateSessionKey={createSessionKey}
          onRevokeSessionKey={revokeSessionKey}
          onRefresh={refresh}
          isCreating={isCreating}
          isRevoking={isRevoking}
        />

        {/* Security Notice */}
        <div
          className="mt-8 rounded-lg p-4 border"
          style={{
            backgroundColor: 'rgb(var(--warning) / 0.1)',
            borderColor: 'rgb(var(--warning) / 0.3)',
          }}
        >
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: 'rgb(var(--warning))' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="font-medium" style={{ color: 'rgb(var(--warning))' }}>
                Security Notice
              </h3>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                Session keys have the ability to sign transactions on your behalf. Always set
                appropriate limits and revoke keys when they&apos;re no longer needed. If you
                suspect a session key has been compromised, revoke it immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
