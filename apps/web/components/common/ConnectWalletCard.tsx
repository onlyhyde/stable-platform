'use client'

import { useState } from 'react'
import type { Connector } from 'wagmi'
import { Button } from './Button'
import { Card, CardContent, CardDescription, CardTitle } from './Card'
import { WalletSelectorModal } from './WalletSelectorModal'

interface ConnectWalletCardProps {
  onConnect?: (connectorId?: string) => void
  isConnecting?: boolean
  title?: string
  description?: string
  message?: string
  connectors?: readonly Connector[]
  showModal?: boolean
}

export function ConnectWalletCard({
  onConnect,
  isConnecting = false,
  title = 'Connect Your Wallet',
  description = 'Connect your wallet to continue',
  message,
  connectors = [],
  showModal = true,
}: ConnectWalletCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingConnector, setPendingConnector] = useState<string>()

  // Simple message-only variant
  if (message && !onConnect) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>{message}</p>
      </div>
    )
  }

  const handleConnect = () => {
    if (showModal && connectors.length > 0) {
      setIsModalOpen(true)
    } else {
      onConnect?.()
    }
  }

  const handleSelectWallet = (connectorId: string) => {
    setPendingConnector(connectorId)
    onConnect?.(connectorId)
    setTimeout(() => {
      setIsModalOpen(false)
      setPendingConnector(undefined)
    }, 1500)
  }

  return (
    <>
      <Card>
        <CardContent className="py-12 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgb(var(--secondary))' }}
          >
            <svg
              className="w-8 h-8"
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-2 mb-6">{description}</CardDescription>
          {onConnect && (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
        </CardContent>
      </Card>

      {showModal && connectors.length > 0 && (
        <WalletSelectorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          connectors={connectors}
          onSelectWallet={handleSelectWallet}
          isConnecting={isConnecting}
          pendingConnector={pendingConnector}
        />
      )}
    </>
  )
}
