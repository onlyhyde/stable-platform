'use client'

import { useState } from 'react'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { PageHeader } from '@/components/common'
import {
  AccountSettingsCard,
  DeveloperSettingsCard,
  NetworkSettingsCard,
  SecuritySettingsCard,
  SocialRecoveryCard,
} from '@/components/settings'
import { useWallet } from '@/hooks'
import { defaultChain } from '@/lib/chains'

type SettingsTab = 'network' | 'account' | 'security' | 'developer'

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'network',
    label: 'Network',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
  },
  {
    id: 'account',
    label: 'Account',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg
        className="w-5 h-5"
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
    ),
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('network')
  const { isConnected, address } = useWallet()
  const { chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your network, account, and security preferences"
      />

      {/* Tab Navigation */}
      <div className="border-b" style={{ borderColor: 'rgb(var(--border))' }}>
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: activeTab === tab.id ? 'rgb(var(--primary))' : 'transparent',
                color:
                  activeTab === tab.id ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'network' && (
          <NetworkSettingsCard
            currentChainId={chain?.id ?? defaultChain.id}
            onSwitchChain={(chainId) => switchChain?.({ chainId })}
          />
        )}

        {activeTab === 'account' && (
          <AccountSettingsCard
            isConnected={isConnected}
            address={address}
            onDisconnect={() => disconnect()}
          />
        )}

        {activeTab === 'security' && (
          <>
            <SecuritySettingsCard />
            <SocialRecoveryCard />
          </>
        )}

        {activeTab === 'developer' && <DeveloperSettingsCard />}
      </div>
    </div>
  )
}
