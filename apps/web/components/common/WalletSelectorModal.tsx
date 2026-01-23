'use client'

import { Modal } from './Modal'
import type { Connector } from 'wagmi'

interface WalletSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  connectors: readonly Connector[]
  onSelectWallet: (connectorId: string) => void
  isConnecting?: boolean
  pendingConnector?: string
}

// Wallet icons by connector name/id
const walletIcons: Record<string, { icon: string; color: string; label?: string }> = {
  // StableNet Wallet
  stablenet: { icon: '💎', color: 'bg-primary-100' },
  'dev.stablenet.wallet': { icon: '💎', color: 'bg-primary-100' },
  'stablenet wallet': { icon: '💎', color: 'bg-primary-100' },
  // MetaMask
  metaMask: { icon: '🦊', color: 'bg-orange-100' },
  metamask: { icon: '🦊', color: 'bg-orange-100' },
  'io.metamask': { icon: '🦊', color: 'bg-orange-100' },
  // Rabby
  rabby: { icon: '🐰', color: 'bg-blue-100' },
  'io.rabby': { icon: '🐰', color: 'bg-blue-100' },
  // Coinbase
  coinbaseWallet: { icon: '🔵', color: 'bg-blue-100' },
  // WalletConnect
  walletConnect: { icon: '🔗', color: 'bg-purple-100', label: 'WalletConnect' },
  // Generic
  injected: { icon: '🌐', color: 'bg-gray-100', label: 'Browser Wallet' },
  default: { icon: '👛', color: 'bg-gray-100' },
}

function getWalletInfo(connector: Connector) {
  const id = connector.id.toLowerCase()
  const name = connector.name.toLowerCase()

  // Try to match by id first, then name
  const info = walletIcons[id] ||
               walletIcons[name] ||
               Object.entries(walletIcons).find(([key]) =>
                 id.includes(key) || name.includes(key)
               )?.[1] ||
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
    const existingIndex = acc.findIndex(c => c.name === connector.name)
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
      description="Select a wallet to connect to StableNet"
      size="sm"
    >
      <div className="px-6 pb-6">
        <div className="space-y-2">
          {uniqueConnectors.map((connector) => {
            const { icon, color } = getWalletInfo(connector)
            const isPending = pendingConnector === connector.id
            const isDisabled = isConnecting && !isPending

            return (
              <button
                key={connector.id}
                type="button"
                onClick={() => handleSelect(connector.id)}
                disabled={isDisabled}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-lg border transition-all
                  ${isPending
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-xl`}>
                  {icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{connector.name}</div>
                  {connector.id !== connector.name.toLowerCase().replace(/\s/g, '') && (
                    <div className="text-xs text-gray-500">{connector.id}</div>
                  )}
                </div>
                {isPending && (
                  <div className="flex items-center gap-2 text-primary-600">
                    <div className="animate-spin w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full" />
                    <span className="text-sm">Connecting...</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {uniqueConnectors.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🔌</div>
            <p className="text-gray-600 font-medium">No wallet detected</p>
            <p className="text-sm text-gray-500 mt-1">
              Please install MetaMask or another Web3 wallet
            </p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            By connecting, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </Modal>
  )
}
