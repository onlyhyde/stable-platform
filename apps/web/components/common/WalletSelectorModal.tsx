'use client'

import type { Connector } from 'wagmi'
import { cn } from '@/lib/utils'
import { Modal } from './Modal'

interface WalletSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  connectors: readonly Connector[]
  onSelectWallet: (connectorId: string) => void
  isConnecting?: boolean
  pendingConnector?: string
}

// Wallet icons by connector name/id
const walletIcons: Record<
  string,
  { icon: string; gradientFrom: string; gradientTo: string; label?: string }
> = {
  // StableNet Wallet
  stablenet: { icon: '⚡', gradientFrom: 'from-primary-500', gradientTo: 'to-primary-600' },
  'dev.stablenet.wallet': {
    icon: '⚡',
    gradientFrom: 'from-primary-500',
    gradientTo: 'to-primary-600',
  },
  'stablenet wallet': {
    icon: '⚡',
    gradientFrom: 'from-primary-500',
    gradientTo: 'to-primary-600',
  },
  // MetaMask
  metaMask: { icon: '🦊', gradientFrom: 'from-orange-400', gradientTo: 'to-orange-600' },
  metamask: { icon: '🦊', gradientFrom: 'from-orange-400', gradientTo: 'to-orange-600' },
  'io.metamask': { icon: '🦊', gradientFrom: 'from-orange-400', gradientTo: 'to-orange-600' },
  // Rabby
  rabby: { icon: '🐰', gradientFrom: 'from-blue-400', gradientTo: 'to-blue-600' },
  'io.rabby': { icon: '🐰', gradientFrom: 'from-blue-400', gradientTo: 'to-blue-600' },
  // Coinbase
  coinbaseWallet: {
    icon: '🔵',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-700',
    label: 'Coinbase',
  },
  // Generic
  injected: {
    icon: '🌐',
    gradientFrom: 'from-dark-400',
    gradientTo: 'to-dark-600',
    label: 'Browser Wallet',
  },
  default: { icon: '👛', gradientFrom: 'from-dark-400', gradientTo: 'to-dark-600' },
}

function getWalletInfo(connector: Connector) {
  const id = connector.id.toLowerCase()
  const name = connector.name.toLowerCase()

  const info =
    walletIcons[id] ||
    walletIcons[name] ||
    Object.entries(walletIcons).find(([key]) => id.includes(key) || name.includes(key))?.[1] ||
    walletIcons.default

  return info
}

export function WalletSelectorModal({
  isOpen,
  onClose,
  connectors,
  onSelectWallet,
  isConnecting = false,
  pendingConnector,
}: WalletSelectorModalProps) {
  const handleSelect = (connectorId: string) => {
    onSelectWallet(connectorId)
  }

  // Filter out duplicate connectors (same name)
  const uniqueConnectors = connectors.reduce((acc, connector) => {
    const existingIndex = acc.findIndex((c) => c.name === connector.name)
    if (existingIndex === -1) {
      acc.push(connector)
    }
    return acc
  }, [] as Connector[])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Wallet"
      description="Choose your preferred wallet to continue"
      size="sm"
    >
      <div className="space-y-3">
        {uniqueConnectors.map((connector) => {
          const { icon, gradientFrom, gradientTo } = getWalletInfo(connector)
          const isPending = pendingConnector === connector.id
          const isDisabled = isConnecting && !isPending

          return (
            <button
              key={connector.id}
              type="button"
              onClick={() => handleSelect(connector.id)}
              disabled={isDisabled}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-150 group',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{
                borderColor: isPending ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                backgroundColor: isPending ? 'rgb(var(--primary) / 0.1)' : 'transparent',
              }}
            >
              {/* Wallet Icon */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl shadow-soft',
                  'transform group-hover:scale-105 transition-transform duration-150',
                  gradientFrom,
                  gradientTo
                )}
              >
                <span className="drop-shadow-sm">{icon}</span>
              </div>

              {/* Wallet Info */}
              <div className="flex-1 text-left">
                <div
                  className="font-semibold transition-colors"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  {connector.name}
                </div>
                <div className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {isPending ? 'Awaiting approval...' : 'Click to connect'}
                </div>
              </div>

              {/* Status */}
              {isPending ? (
                <div className="flex items-center gap-2" style={{ color: 'rgb(var(--primary))' }}>
                  <div
                    className="animate-spin w-5 h-5 border-2 rounded-full"
                    style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
                  />
                </div>
              ) : (
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-all duration-150"
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </button>
          )
        })}
      </div>

      {uniqueConnectors.length === 0 && (
        <div className="text-center py-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
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
                strokeWidth={1.5}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          <p className="font-semibold mb-1" style={{ color: 'rgb(var(--foreground))' }}>
            No wallet detected
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Please install MetaMask or another Web3 wallet to continue
          </p>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-white font-medium transition-colors"
            style={{ backgroundColor: 'rgb(var(--primary))' }}
          >
            <span>Install MetaMask</span>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      )}

      <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
        <div
          className="flex items-center justify-center gap-2 text-xs"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          <svg
            className="w-4 h-4"
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
          <span>Secure, encrypted connection</span>
        </div>
      </div>
    </Modal>
  )
}
