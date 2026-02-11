'use client'

import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Toggle } from '@/components/common/Toggle'

interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  active: boolean
  secret: string
  createdAt: Date
  lastTriggered?: Date
}

interface WebhookSettingsCardProps {
  endpoints: WebhookEndpoint[]
  onAddEndpoint: (url: string, events: string[]) => Promise<void>
  onDeleteEndpoint: (id: string) => Promise<void>
  onToggleEndpoint: (id: string, active: boolean) => Promise<void>
  onRegenerateSecret: (id: string) => Promise<string>
}

const AVAILABLE_EVENTS = [
  { id: 'subscription.created', label: 'Subscription Created' },
  { id: 'subscription.cancelled', label: 'Subscription Cancelled' },
  { id: 'subscription.expiring', label: 'Subscription Expiring' },
  { id: 'payment.success', label: 'Payment Success' },
  { id: 'payment.failed', label: 'Payment Failed' },
]

export function WebhookSettingsCard({
  endpoints,
  onAddEndpoint,
  onDeleteEndpoint,
  onToggleEndpoint,
  onRegenerateSecret,
}: WebhookSettingsCardProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})

  const handleAddEndpoint = async () => {
    if (!newUrl || selectedEvents.length === 0) return

    setIsLoading(true)
    try {
      await onAddEndpoint(newUrl, selectedEvents)
      setNewUrl('')
      setSelectedEvents([])
      setShowAddForm(false)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    )
  }

  const toggleSecretVisibility = (id: string) => {
    setShowSecret((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhook Endpoints</CardTitle>
            <CardDescription>
              Configure webhook URLs to receive real-time event notifications
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add Endpoint'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAddForm && (
          <div
            className="mb-6 p-4 rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--secondary))',
              border: '1px solid rgb(var(--border))',
            }}
          >
            <h4 className="font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
              New Webhook Endpoint
            </h4>
            <div className="space-y-4">
              <div>
                <span
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'rgb(var(--foreground) / 0.8)' }}
                >
                  Endpoint URL
                </span>
                <Input
                  type="url"
                  placeholder="https://your-server.com/webhook"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </div>
              <div>
                <span
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'rgb(var(--foreground) / 0.8)' }}
                >
                  Events to Listen
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-center gap-2 p-2 rounded cursor-pointer hover:opacity-80"
                      style={{ border: '1px solid rgb(var(--border))' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="rounded"
                        style={{ borderColor: 'rgb(var(--border-hover))' }}
                      />
                      <span className="text-sm" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                        {event.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleAddEndpoint}
                  disabled={isLoading || !newUrl || selectedEvents.length === 0}
                >
                  {isLoading ? 'Adding...' : 'Add Endpoint'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {endpoints.length === 0 ? (
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <p>No webhook endpoints configured</p>
            <p className="text-sm">Add an endpoint to start receiving event notifications</p>
          </div>
        ) : (
          <div className="space-y-4">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                className="p-4 rounded-lg"
                style={{ border: '1px solid rgb(var(--border))' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: endpoint.active
                            ? 'rgb(var(--success))'
                            : 'rgb(var(--muted-foreground) / 0.5)',
                        }}
                      />
                      <code
                        className="text-sm font-mono break-all"
                        style={{ color: 'rgb(var(--foreground) / 0.8)' }}
                      >
                        {endpoint.url}
                      </code>
                    </div>
                    <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      Created: {endpoint.createdAt.toLocaleDateString()}
                      {endpoint.lastTriggered &&
                        ` | Last triggered: ${endpoint.lastTriggered.toLocaleDateString()}`}
                    </p>
                  </div>
                  <Toggle
                    checked={endpoint.active}
                    onChange={(checked) => onToggleEndpoint(endpoint.id, checked)}
                  />
                </div>

                <div className="mb-3">
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Events:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {endpoint.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-1 text-xs rounded"
                        style={{
                          backgroundColor: 'rgb(var(--primary) / 0.1)',
                          color: 'rgb(var(--primary))',
                        }}
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    Signing Secret:
                  </p>
                  <div className="flex items-center gap-2">
                    <code
                      className="flex-1 text-xs font-mono px-2 py-1 rounded"
                      style={{
                        backgroundColor: 'rgb(var(--secondary))',
                        color: 'rgb(var(--foreground))',
                      }}
                    >
                      {showSecret[endpoint.id] ? endpoint.secret : '••••••••••••••••'}
                    </code>
                    <button
                      type="button"
                      onClick={() => toggleSecretVisibility(endpoint.id)}
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {showSecret[endpoint.id] ? (
                        <svg
                          aria-hidden="true"
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRegenerateSecret(endpoint.id)}
                      className="text-xs"
                      style={{ color: 'rgb(var(--primary))' }}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onDeleteEndpoint(endpoint.id)}
                    className="text-sm"
                    style={{ color: 'rgb(var(--destructive))' }}
                  >
                    Delete Endpoint
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
