'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type Address, formatUnits, parseUnits } from 'viem'
import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/common/Toast'
import { useSubscription } from '@/hooks/useSubscription'
import { useSubscriptionEvents } from '@/hooks/useSubscriptionEvents'
import { useWallet } from '@/hooks/useWallet'
import type { PlanDisplayInfo } from '@/types/subscription'
import { INTERVAL_PRESETS } from '@/types/subscription'
import { ApiKeysCard } from './cards/ApiKeysCard'
import { MerchantStatsCards } from './cards/MerchantStatsCards'
import { PaymentAnalyticsCard } from './cards/PaymentAnalyticsCard'
import { RecentTransactionsCard } from './cards/RecentTransactionsCard'
import { SubscriptionPlansCard } from './cards/SubscriptionPlansCard'
import { WebhookSettingsCard } from './cards/WebhookSettingsCard'

// ---------- Local types (matching child card prop shapes) ----------

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

// ---------- Constants ----------

const TOKEN_REVERSE: Record<string, Address> = {
  USDC: '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
  ETH: '0x0000000000000000000000000000000000000000',
}

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  ETH: 18,
}

const WEBHOOKS_STORAGE_KEY = 'stablenet:merchant-webhooks'
const APIKEYS_STORAGE_KEY = 'stablenet:merchant-apikeys'

// ---------- Helpers ----------

function mapInterval(seconds: bigint): 'daily' | 'weekly' | 'monthly' | 'yearly' {
  const s = Number(seconds)
  if (s === 86400) return 'daily'
  if (s === 604800) return 'weekly'
  if (s === 2592000) return 'monthly'
  if (s === 31536000) return 'yearly'
  return 'monthly'
}

function toCardPlan(p: PlanDisplayInfo): SubscriptionPlan {
  return {
    id: p.id.toString(),
    name: p.name,
    description: p.description,
    price: Number(formatUnits(p.price, p.tokenDecimals)),
    token: p.tokenSymbol,
    interval: mapInterval(p.interval),
    activeSubscribers: Number(p.subscriberCount),
    totalRevenue: 0,
    isActive: p.isActive,
    createdAt: new Date(Number(p.createdAt) * 1000),
  }
}

function loadFromStorage<T>(key: string, dateFields: string[]): T[] {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return []
    const parsed = JSON.parse(stored) as Record<string, unknown>[]
    return parsed.map((item) => {
      const result = { ...item }
      for (const field of dateFields) {
        if (result[field]) result[field] = new Date(result[field] as string)
      }
      return result as T
    })
  } catch {
    return []
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

// ---------- Component ----------

export function MerchantDashboard() {
  const router = useRouter()
  const { isConnected, address } = useWallet()
  const { merchantPlans, merchantStats, loadMerchantPlans, createPlan } = useSubscription()
  const { addToast } = useToast()

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])

  // On-chain event data for analytics
  const {
    paymentData: eventPaymentData,
    transactions: eventTransactions,
    stats: eventStats,
    isLoading: isLoadingEvents,
    refetch: refetchEvents,
  } = useSubscriptionEvents(timeRange)

  // Load merchant plans on mount
  useEffect(() => {
    if (isConnected && address) {
      loadMerchantPlans()
    }
  }, [isConnected, address, loadMerchantPlans])

  // Load webhooks and API keys from localStorage
  useEffect(() => {
    setWebhooks(
      loadFromStorage<WebhookEndpoint>(WEBHOOKS_STORAGE_KEY, ['createdAt', 'lastTriggered'])
    )
    setApiKeys(loadFromStorage<ApiKey>(APIKEYS_STORAGE_KEY, ['createdAt', 'lastUsed', 'expiresAt']))
  }, [])

  // Map contract data to card-compatible types
  const plans: SubscriptionPlan[] = merchantPlans.map(toCardPlan)

  // Merge on-chain plan data with event-based stats
  const totalSubscribers = plans.reduce((sum, p) => sum + p.activeSubscribers, 0)

  const stats: MerchantStats = {
    totalRevenue: eventStats.totalRevenue,
    revenueChange: eventStats.revenueChange,
    activeSubscriptions: merchantStats?.activeSubscribers ?? totalSubscribers,
    subscriptionChange: eventStats.subscriptionChange,
    successfulPayments: eventStats.totalPayments,
    paymentSuccessRate: eventStats.paymentSuccessRate,
    avgTransactionValue: eventStats.avgTransactionValue,
    avgValueChange: eventStats.avgValueChange,
  }

  // Use event-based data for analytics and transaction history
  const transactions: Transaction[] = eventTransactions
  const paymentData: PaymentData[] = eventPaymentData

  // ---------- Plan Handlers ----------

  const handleCreatePlan = async (
    plan: Omit<SubscriptionPlan, 'id' | 'activeSubscribers' | 'totalRevenue' | 'createdAt'>
  ) => {
    const tokenAddress = TOKEN_REVERSE[plan.token] ?? TOKEN_REVERSE.USDC
    const decimals = TOKEN_DECIMALS[plan.token] ?? 6
    const priceWei = parseUnits(plan.price.toString(), decimals)
    const intervalSeconds =
      INTERVAL_PRESETS[plan.interval as keyof typeof INTERVAL_PRESETS] ?? INTERVAL_PRESETS.monthly

    try {
      await createPlan({
        name: plan.name,
        description: plan.description,
        price: priceWei,
        interval: intervalSeconds,
        token: tokenAddress,
      })
      await loadMerchantPlans()
      addToast({
        type: 'success',
        title: 'Plan Created',
        message: `"${plan.name}" created successfully`,
      })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Create Plan Failed',
        message: err instanceof Error ? err.message : 'Failed to create plan',
      })
    }
  }

  const handleUpdatePlan = async (_id: string, _updates: Partial<SubscriptionPlan>) => {
    addToast({
      type: 'info',
      title: 'Not Supported',
      message: 'Plan update requires a contract upgrade',
    })
  }

  const handleTogglePlan = async (_id: string, _isActive: boolean) => {
    addToast({
      type: 'info',
      title: 'Not Supported',
      message: 'Plan toggle requires a contract upgrade',
    })
  }

  // ---------- Webhook Handlers ----------

  const handleAddWebhook = async (url: string, events: string[]) => {
    const newWebhook: WebhookEndpoint = {
      id: crypto.randomUUID(),
      url,
      events,
      active: true,
      secret: `whsec_${crypto.randomUUID().replace(/-/g, '')}`,
      createdAt: new Date(),
    }
    const updated = [...webhooks, newWebhook]
    setWebhooks(updated)
    saveToStorage(WEBHOOKS_STORAGE_KEY, updated)
    addToast({ type: 'success', title: 'Webhook Added', message: `Endpoint ${url} added` })
  }

  const handleDeleteWebhook = async (id: string) => {
    const updated = webhooks.filter((w) => w.id !== id)
    setWebhooks(updated)
    saveToStorage(WEBHOOKS_STORAGE_KEY, updated)
    addToast({ type: 'success', title: 'Webhook Deleted', message: 'Endpoint removed' })
  }

  const handleToggleWebhook = async (id: string, active: boolean) => {
    const updated = webhooks.map((w) => (w.id === id ? { ...w, active } : w))
    setWebhooks(updated)
    saveToStorage(WEBHOOKS_STORAGE_KEY, updated)
  }

  const handleRegenerateSecret = async (id: string) => {
    const newSecret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`
    const updated = webhooks.map((w) => (w.id === id ? { ...w, secret: newSecret } : w))
    setWebhooks(updated)
    saveToStorage(WEBHOOKS_STORAGE_KEY, updated)
    addToast({
      type: 'success',
      title: 'Secret Regenerated',
      message: 'New webhook secret generated',
    })
    return newSecret
  }

  // ---------- API Key Handlers ----------

  const handleCreateApiKey = async (name: string, permissions: string[]) => {
    const fullKey = `sk_test_${crypto.randomUUID().replace(/-/g, '')}`
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      name,
      keyPrefix: fullKey.slice(0, 14) + '...',
      permissions,
      createdAt: new Date(),
    }
    const updated = [...apiKeys, newKey]
    setApiKeys(updated)
    saveToStorage(APIKEYS_STORAGE_KEY, updated)
    addToast({ type: 'success', title: 'API Key Created', message: `Key "${name}" created` })
    return { key: fullKey }
  }

  const handleRevokeApiKey = async (id: string) => {
    const updated = apiKeys.filter((k) => k.id !== id)
    setApiKeys(updated)
    saveToStorage(APIKEYS_STORAGE_KEY, updated)
    addToast({ type: 'success', title: 'API Key Revoked', message: 'Key has been revoked' })
  }

  // ---------- Render ----------

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'rgb(var(--background))' }}>
      <PageHeader
        title="Merchant Dashboard"
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
              onViewAll={() => router.push('/payment/history')}
              onRetry={async (_id) => {
                addToast({
                  type: 'info',
                  title: 'Not Supported',
                  message: 'Retry is not yet supported',
                })
              }}
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
