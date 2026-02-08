'use client'

import { PageHeader } from '@/components/common/PageHeader'
import { useState } from 'react'
import { ApiKeysCard } from './cards/ApiKeysCard'
import { MerchantStatsCards } from './cards/MerchantStatsCards'
import { PaymentAnalyticsCard } from './cards/PaymentAnalyticsCard'
import { RecentTransactionsCard } from './cards/RecentTransactionsCard'
import { SubscriptionPlansCard } from './cards/SubscriptionPlansCard'
import { WebhookSettingsCard } from './cards/WebhookSettingsCard'

// Types
interface MerchantStats {
  totalRevenue: number
  revenueChange: number
  activeSubscriptions: number
  subscriptionChange: number
  successfulPayments: number
  paymentSuccessRate: number
  avgTransactionValue: number
  avgValueChange: number
}

interface PaymentData {
  date: string
  successful: number
  failed: number
  revenue: number
}

interface Transaction {
  id: string
  subscriptionId: string
  subscriberAddress: string
  amount: number
  token: string
  status: 'success' | 'failed' | 'pending' | 'refunded'
  txHash?: string
  createdAt: Date
  errorMessage?: string
}

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  token: string
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly'
  activeSubscribers: number
  totalRevenue: number
  isActive: boolean
  createdAt: Date
}

interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  active: boolean
  secret: string
  createdAt: Date
  lastTriggered?: Date
}

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  createdAt: Date
  lastUsed?: Date
  expiresAt?: Date
}

type TabId = 'overview' | 'plans' | 'webhooks' | 'api-keys'

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'plans', label: 'Plans' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'api-keys', label: 'API Keys' },
]

interface MerchantDashboardProps {
  merchantId: string
  merchantName: string
}

export function MerchantDashboard({ merchantId: _merchantId, merchantName }: MerchantDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  // Mock data - in real app, these would come from API
  const stats: MerchantStats = {
    totalRevenue: 125430,
    revenueChange: 12.5,
    activeSubscriptions: 1234,
    subscriptionChange: 8.2,
    successfulPayments: 3456,
    paymentSuccessRate: 98.5,
    avgTransactionValue: 36.28,
    avgValueChange: 3.1,
  }

  const paymentData: PaymentData[] = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return {
      date: date.toISOString().split('T')[0],
      successful: Math.floor(Math.random() * 100) + 50,
      failed: Math.floor(Math.random() * 10),
      revenue: Math.floor(Math.random() * 5000) + 1000,
    }
  })

  const transactions: Transaction[] = [
    {
      id: 'tx_001',
      subscriptionId: 'sub_001',
      subscriberAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: 9.99,
      token: 'USDC',
      status: 'success',
      txHash: '0xabc123...',
      createdAt: new Date(Date.now() - 3600000),
    },
    {
      id: 'tx_002',
      subscriptionId: 'sub_002',
      subscriberAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      amount: 29.99,
      token: 'USDC',
      status: 'success',
      txHash: '0xdef456...',
      createdAt: new Date(Date.now() - 7200000),
    },
    {
      id: 'tx_003',
      subscriptionId: 'sub_003',
      subscriberAddress: '0x567890abcdef1234567890abcdef1234567890ab',
      amount: 9.99,
      token: 'USDC',
      status: 'failed',
      createdAt: new Date(Date.now() - 10800000),
      errorMessage: 'Insufficient allowance',
    },
  ]

  const plans: SubscriptionPlan[] = [
    {
      id: 'plan_001',
      name: 'Basic',
      description: 'Essential features for individuals',
      price: 9.99,
      token: 'USDC',
      interval: 'monthly',
      activeSubscribers: 523,
      totalRevenue: 15690,
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 'plan_002',
      name: 'Pro',
      description: 'Advanced features for professionals',
      price: 29.99,
      token: 'USDC',
      interval: 'monthly',
      activeSubscribers: 287,
      totalRevenue: 25797,
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
  ]

  const webhooks: WebhookEndpoint[] = [
    {
      id: 'wh_001',
      url: 'https://api.example.com/webhooks/payments',
      events: ['payment.success', 'payment.failed'],
      active: true,
      secret: 'whsec_abc123def456',
      createdAt: new Date('2024-01-15'),
      lastTriggered: new Date(Date.now() - 3600000),
    },
  ]

  const apiKeys: ApiKey[] = [
    {
      id: 'key_001',
      name: 'Production Server',
      keyPrefix: 'sk_live_abc123',
      permissions: ['subscriptions:read', 'subscriptions:write', 'payments:read'],
      createdAt: new Date('2024-01-10'),
      lastUsed: new Date(Date.now() - 1800000),
    },
  ]

  // Handlers
  const handleCreatePlan = async (
    _plan: Omit<SubscriptionPlan, 'id' | 'activeSubscribers' | 'totalRevenue' | 'createdAt'>
  ) => {
    // TODO: API call to create plan
  }

  const handleUpdatePlan = async (_id: string, _updates: Partial<SubscriptionPlan>) => {
    // TODO: API call to update plan
  }

  const handleTogglePlan = async (_id: string, _isActive: boolean) => {
    // TODO: API call to toggle plan
  }

  const handleAddWebhook = async (_url: string, _events: string[]) => {
    // TODO: API call to add webhook
  }

  const handleDeleteWebhook = async (_id: string) => {
    // TODO: API call to delete webhook
  }

  const handleToggleWebhook = async (_id: string, _active: boolean) => {
    // TODO: API call to toggle webhook
  }

  const handleRegenerateSecret = async (_id: string) => {
    // TODO: API call to regenerate secret
    return 'whsec_new_secret_xyz'
  }

  const handleCreateApiKey = async (_name: string, _permissions: string[]) => {
    // TODO: API call to create API key
    return { key: 'sk_live_new_key_abc123def456ghi789' }
  }

  const handleRevokeApiKey = async (_id: string) => {
    // TODO: API call to revoke API key
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgb(var(--background))' }}>
      <PageHeader
        title={`${merchantName} Dashboard`}
        description="Manage your subscriptions, payments, and integrations"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="mb-6" style={{ borderBottom: '1px solid rgb(var(--border))' }}>
          <nav className="flex gap-8" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="pb-4 px-1 border-b-2 font-medium text-sm transition-colors"
                style={{
                  borderColor: activeTab === tab.id ? 'rgb(var(--primary))' : 'transparent',
                  color:
                    activeTab === tab.id ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <MerchantStatsCards stats={stats} />
            <PaymentAnalyticsCard
              data={paymentData}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
            <RecentTransactionsCard
              transactions={transactions}
              onViewAll={() => console.log('View all transactions')}
              onRetry={async (id) => console.log('Retry:', id)}
            />
          </div>
        )}

        {activeTab === 'plans' && (
          <SubscriptionPlansCard
            plans={plans}
            onCreatePlan={handleCreatePlan}
            onUpdatePlan={handleUpdatePlan}
            onTogglePlan={handleTogglePlan}
          />
        )}

        {activeTab === 'webhooks' && (
          <WebhookSettingsCard
            endpoints={webhooks}
            onAddEndpoint={handleAddWebhook}
            onDeleteEndpoint={handleDeleteWebhook}
            onToggleEndpoint={handleToggleWebhook}
            onRegenerateSecret={handleRegenerateSecret}
          />
        )}

        {activeTab === 'api-keys' && (
          <ApiKeysCard
            apiKeys={apiKeys}
            onCreateKey={handleCreateApiKey}
            onRevokeKey={handleRevokeApiKey}
          />
        )}
      </div>
    </div>
  )
}
