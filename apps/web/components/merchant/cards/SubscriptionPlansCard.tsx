'use client'

import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Modal } from '@/components/common/Modal'

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

interface SubscriptionPlansCardProps {
  plans: SubscriptionPlan[]
  onCreatePlan: (
    plan: Omit<SubscriptionPlan, 'id' | 'activeSubscribers' | 'totalRevenue' | 'createdAt'>
  ) => Promise<void>
  onUpdatePlan: (id: string, updates: Partial<SubscriptionPlan>) => Promise<void>
  onTogglePlan: (id: string, isActive: boolean) => Promise<void>
}

const INTERVALS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const TOKENS = [
  { value: 'USDC', label: 'USDC' },
  { value: 'USDT', label: 'USDT' },
  { value: 'DAI', label: 'DAI' },
]

export function SubscriptionPlansCard({
  plans,
  onCreatePlan,
  onUpdatePlan,
  onTogglePlan,
}: SubscriptionPlansCardProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    token: 'USDC',
    interval: 'monthly' as const,
    isActive: true,
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    price: '',
    token: 'USDC',
    interval: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    isActive: true,
  })

  const handleCreatePlan = async () => {
    if (!formData.name || !formData.price) return

    setIsLoading(true)
    try {
      await onCreatePlan({
        name: formData.name,
        description: formData.description,
        price: Number.parseFloat(formData.price),
        token: formData.token,
        interval: formData.interval,
        isActive: formData.isActive,
      })
      setShowCreateModal(false)
      setFormData({
        name: '',
        description: '',
        price: '',
        token: 'USDC',
        interval: 'monthly',
        isActive: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setEditFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price.toString(),
      token: plan.token,
      interval: plan.interval,
      isActive: plan.isActive,
    })
    setShowEditModal(true)
  }

  const handleUpdatePlan = async () => {
    if (!editingPlan || !editFormData.name || !editFormData.price) return

    setIsLoading(true)
    try {
      await onUpdatePlan(editingPlan.id, {
        name: editFormData.name,
        description: editFormData.description,
        price: Number.parseFloat(editFormData.price),
        token: editFormData.token,
        interval: editFormData.interval,
        isActive: editFormData.isActive,
      })
      setShowEditModal(false)
      setEditingPlan(null)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number, token: string) => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${token}`
  }

  const intervalLabel = (interval: string) => {
    const found = INTERVALS.find((i) => i.value === interval)
    return found ? found.label : interval
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Plans</CardTitle>
              <CardDescription>Manage your subscription plans and pricing</CardDescription>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>Create Plan</Button>
          </div>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
              <svg
                aria-hidden="true"
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: 'rgb(var(--muted-foreground) / 0.5)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p>No subscription plans created</p>
              <p className="text-sm">Create a plan to start accepting subscriptions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-4 rounded-lg"
                  style={{
                    border: `1px solid ${plan.isActive ? 'rgb(var(--border))' : 'rgb(var(--border) / 0.5)'}`,
                    backgroundColor: plan.isActive ? 'transparent' : 'rgb(var(--secondary))',
                    opacity: plan.isActive ? 1 : 0.75,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {plan.name}
                      </h4>
                      {plan.description && (
                        <p
                          className="text-sm mt-1"
                          style={{ color: 'rgb(var(--muted-foreground))' }}
                        >
                          {plan.description}
                        </p>
                      )}
                    </div>
                    <span
                      className="px-2 py-0.5 text-xs rounded-full"
                      style={{
                        backgroundColor: plan.isActive
                          ? 'rgb(var(--success) / 0.1)'
                          : 'rgb(var(--secondary))',
                        color: plan.isActive
                          ? 'rgb(var(--success))'
                          : 'rgb(var(--muted-foreground))',
                      }}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
                      {formatCurrency(plan.price, plan.token)}
                      <span
                        className="text-sm font-normal"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        /{intervalLabel(plan.interval).toLowerCase()}
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div
                      className="p-2 rounded"
                      style={{ backgroundColor: 'rgb(var(--secondary))' }}
                    >
                      <p style={{ color: 'rgb(var(--muted-foreground))' }}>Subscribers</p>
                      <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {plan.activeSubscribers}
                      </p>
                    </div>
                    <div
                      className="p-2 rounded"
                      style={{ backgroundColor: 'rgb(var(--secondary))' }}
                    >
                      <p style={{ color: 'rgb(var(--muted-foreground))' }}>Revenue</p>
                      <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                        {formatCurrency(plan.totalRevenue, plan.token)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => onTogglePlan(plan.id, !plan.isActive)}
                      className="text-sm opacity-50 cursor-not-allowed"
                      style={{
                        color: 'rgb(var(--muted-foreground))',
                      }}
                      title="Requires contract upgrade"
                    >
                      {plan.isActive ? 'Deactivate' : 'Activate'}
                      <span className="ml-1 text-xs">(Soon)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditClick(plan)}
                      className="text-sm opacity-50 cursor-not-allowed"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                      title="Requires contract upgrade"
                    >
                      Edit
                      <span className="ml-1 text-xs">(Soon)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Plan Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingPlan(null)
        }}
        title="Edit Subscription Plan"
      >
        <div className="space-y-4">
          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Plan Name *
            </span>
            <Input
              placeholder="e.g., Pro Plan"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            />
          </div>

          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Description
            </span>
            <textarea
              className="w-full px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2"
              style={{
                border: '1px solid rgb(var(--border-hover))',
                backgroundColor: 'rgb(var(--background))',
                color: 'rgb(var(--foreground))',
              }}
              rows={3}
              placeholder="Describe what's included in this plan"
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground) / 0.8)' }}
              >
                Price *
              </span>
              <Input
                type="number"
                placeholder="0.00"
                value={editFormData.price}
                onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
              />
            </div>
            <div>
              <span
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground) / 0.8)' }}
              >
                Token
              </span>
              <select
                className="w-full px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2"
                style={{
                  border: '1px solid rgb(var(--border-hover))',
                  backgroundColor: 'rgb(var(--background))',
                  color: 'rgb(var(--foreground))',
                }}
                value={editFormData.token}
                onChange={(e) => setEditFormData({ ...editFormData, token: e.target.value })}
              >
                {TOKENS.map((token) => (
                  <option key={token.value} value={token.value}>
                    {token.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Billing Interval
            </span>
            <select
              className="w-full px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2"
              style={{
                border: '1px solid rgb(var(--border-hover))',
                backgroundColor: 'rgb(var(--background))',
                color: 'rgb(var(--foreground))',
              }}
              value={editFormData.interval}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  interval: e.target.value as typeof editFormData.interval,
                })
              }
            >
              {INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsActive"
              checked={editFormData.isActive}
              onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
              className="rounded"
              style={{ borderColor: 'rgb(var(--border-hover))' }}
            />
            <label
              htmlFor="editIsActive"
              className="text-sm"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Plan is active and accepting subscriptions
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowEditModal(false)
                setEditingPlan(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePlan}
              disabled={isLoading || !editFormData.name || !editFormData.price}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Plan Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Subscription Plan"
      >
        <div className="space-y-4">
          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Plan Name *
            </span>
            <Input
              placeholder="e.g., Pro Plan"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Description
            </span>
            <textarea
              className="w-full px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2"
              style={{
                border: '1px solid rgb(var(--border-hover))',
                backgroundColor: 'rgb(var(--background))',
                color: 'rgb(var(--foreground))',
              }}
              rows={3}
              placeholder="Describe what's included in this plan"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground) / 0.8)' }}
              >
                Price *
              </span>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
            <div>
              <span
                className="block text-sm font-medium mb-1"
                style={{ color: 'rgb(var(--foreground) / 0.8)' }}
              >
                Token
              </span>
              <select
                className="w-full px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2"
                style={{
                  border: '1px solid rgb(var(--border-hover))',
                  backgroundColor: 'rgb(var(--background))',
                  color: 'rgb(var(--foreground))',
                }}
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              >
                {TOKENS.map((token) => (
                  <option key={token.value} value={token.value}>
                    {token.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Billing Interval
            </span>
            <select
              className="w-full px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2"
              style={{
                border: '1px solid rgb(var(--border-hover))',
                backgroundColor: 'rgb(var(--background))',
                color: 'rgb(var(--foreground))',
              }}
              value={formData.interval}
              onChange={(e) =>
                setFormData({ ...formData, interval: e.target.value as typeof formData.interval })
              }
            >
              {INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded"
              style={{ borderColor: 'rgb(var(--border-hover))' }}
            />
            <label
              htmlFor="isActive"
              className="text-sm"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Plan is active and accepting subscriptions
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePlan}
              disabled={isLoading || !formData.name || !formData.price}
            >
              {isLoading ? 'Creating...' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
