'use client'

import { Card, CardContent, CardTitle, CardDescription } from './Card'
import { Button } from './Button'

interface ConnectWalletCardProps {
  onConnect?: () => void
  isConnecting?: boolean
  title?: string
  description?: string
  message?: string
}

export function ConnectWalletCard({
  onConnect,
  isConnecting = false,
  title = 'Connect Your Wallet',
  description = 'Connect your wallet to continue',
  message,
}: ConnectWalletCardProps) {
  // Simple message-only variant
  if (message && !onConnect) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">{message}</p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-2 mb-6">{description}</CardDescription>
        {onConnect && (
          <Button onClick={onConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
