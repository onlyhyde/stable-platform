'use client'

import { Button, Card, CardContent } from '@/components/common'

interface RevokeCardProps {
  onRevoke: () => void
  isRevoking: boolean
  isLoading: boolean
  canPerformAction: boolean
}

export function RevokeCard({ onRevoke, isRevoking, isLoading, canPerformAction }: RevokeCardProps) {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgb(var(--destructive) / 0.1)' }}
          >
            <svg
              className="w-8 h-8"
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
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
            Revert to EOA
          </h3>
          <p className="mb-6 max-w-md mx-auto" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Revoke the smart account delegation and return to a regular EOA.
          </p>
          <Button
            variant="danger"
            onClick={onRevoke}
            disabled={isRevoking || isLoading || !canPerformAction}
            className="min-w-[200px]"
          >
            {isRevoking ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Revoking...
              </span>
            ) : !canPerformAction ? (
              'Enter Private Key First'
            ) : (
              'Revoke Smart Account'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
