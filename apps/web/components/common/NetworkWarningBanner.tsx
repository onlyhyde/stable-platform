'use client'

import type { FC } from 'react'
import { useAccount, useChainId, useChains } from 'wagmi'
import { useWalletNetworks } from '@/hooks/useWalletNetworks'

/**
 * Shows a warning banner when the user's wallet is connected to an
 * unsupported network that is not in the wagmi config.
 */
export const NetworkWarningBanner: FC = () => {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const chains = useChains()
  const { switchNetwork } = useWalletNetworks()

  if (!isConnected) return null

  const isSupported = chains.some((c) => c.id === chainId)
  if (isSupported) return null

  const defaultChain = chains[0]

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
      style={{
        backgroundColor: 'rgb(var(--warning) / 0.15)',
        borderBottom: '1px solid rgb(var(--warning) / 0.3)',
      }}
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 flex-shrink-0"
          style={{ color: 'rgb(var(--warning))' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span style={{ color: 'rgb(var(--foreground))' }}>
          You are connected to an unsupported network (Chain ID: {chainId}).
          {defaultChain && ` Please switch to ${defaultChain.name}.`}
        </span>
      </div>
      {defaultChain && (
        <button
          type="button"
          onClick={() => switchNetwork(defaultChain.id)}
          className="px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80"
          style={{
            backgroundColor: 'rgb(var(--warning))',
            color: 'white',
          }}
        >
          Switch Network
        </button>
      )}
    </div>
  )
}
