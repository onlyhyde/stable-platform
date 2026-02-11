'use client'

import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card'
import { Input } from '@/components/common/Input'
import { Modal } from '@/components/common/Modal'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  createdAt: Date
  lastUsed?: Date
  expiresAt?: Date
}

interface ApiKeysCardProps {
  apiKeys: ApiKey[]
  onCreateKey: (name: string, permissions: string[]) => Promise<{ key: string }>
  onRevokeKey: (id: string) => Promise<void>
}

const AVAILABLE_PERMISSIONS = [
  { id: 'subscriptions:read', label: 'Read Subscriptions' },
  { id: 'subscriptions:write', label: 'Create/Modify Subscriptions' },
  { id: 'payments:read', label: 'Read Payment History' },
  { id: 'webhooks:manage', label: 'Manage Webhooks' },
  { id: 'analytics:read', label: 'Read Analytics' },
]

export function ApiKeysCard({ apiKeys, onCreateKey, onRevokeKey }: ApiKeysCardProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCreateKey = async () => {
    if (!newKeyName || selectedPermissions.length === 0) return

    setIsLoading(true)
    try {
      const result = await onCreateKey(newKeyName, selectedPermissions)
      setGeneratedKey(result.key)
      setShowCreateModal(false)
      setShowNewKeyModal(true)
      setNewKeyName('')
      setSelectedPermissions([])
    } finally {
      setIsLoading(false)
    }
  }

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId) ? prev.filter((p) => p !== permissionId) : [...prev, permissionId]
    )
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseNewKeyModal = () => {
    setShowNewKeyModal(false)
    setGeneratedKey('')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for programmatic access to your merchant account
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>Create API Key</Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              <p>No API keys created</p>
              <p className="text-sm">Create an API key to integrate with your systems</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                    <th
                      className="text-left py-3 px-4 text-sm font-medium"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      Name
                    </th>
                    <th
                      className="text-left py-3 px-4 text-sm font-medium"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      Key
                    </th>
                    <th
                      className="text-left py-3 px-4 text-sm font-medium"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      Permissions
                    </th>
                    <th
                      className="text-left py-3 px-4 text-sm font-medium"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      Created
                    </th>
                    <th
                      className="text-left py-3 px-4 text-sm font-medium"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      Last Used
                    </th>
                    <th
                      className="text-right py-3 px-4 text-sm font-medium"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr
                      key={key.id}
                      className="hover:opacity-80"
                      style={{ borderBottom: '1px solid rgb(var(--border) / 0.5)' }}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                          {key.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code
                          className="text-sm font-mono px-2 py-1 rounded"
                          style={{
                            backgroundColor: 'rgb(var(--secondary))',
                            color: 'rgb(var(--foreground))',
                          }}
                        >
                          {key.keyPrefix}...
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.slice(0, 2).map((perm) => (
                            <span
                              key={perm}
                              className="px-2 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: 'rgb(var(--secondary))',
                                color: 'rgb(var(--muted-foreground))',
                              }}
                            >
                              {perm.split(':')[0]}
                            </span>
                          ))}
                          {key.permissions.length > 2 && (
                            <span
                              className="px-2 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: 'rgb(var(--secondary))',
                                color: 'rgb(var(--muted-foreground))',
                              }}
                            >
                              +{key.permissions.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-3 px-4 text-sm"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {key.createdAt.toLocaleDateString()}
                      </td>
                      <td
                        className="py-3 px-4 text-sm"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {key.lastUsed ? key.lastUsed.toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onRevokeKey(key.id)}
                          className="text-sm"
                          style={{ color: 'rgb(var(--destructive))' }}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create API Key"
      >
        <div className="space-y-4">
          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Key Name
            </span>
            <Input
              placeholder="e.g., Production Server"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </div>
          <div>
            <span
              className="block text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Permissions
            </span>
            <div className="space-y-2">
              {AVAILABLE_PERMISSIONS.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-center gap-2 p-2 rounded cursor-pointer hover:opacity-80"
                  style={{ border: '1px solid rgb(var(--border))' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="rounded"
                    style={{ borderColor: 'rgb(var(--border-hover))' }}
                  />
                  <span className="text-sm" style={{ color: 'rgb(var(--foreground) / 0.8)' }}>
                    {permission.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={isLoading || !newKeyName || selectedPermissions.length === 0}
            >
              {isLoading ? 'Creating...' : 'Create Key'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* New Key Display Modal */}
      <Modal isOpen={showNewKeyModal} onClose={handleCloseNewKeyModal} title="API Key Created">
        <div className="space-y-4">
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              border: '1px solid rgb(var(--warning) / 0.3)',
            }}
          >
            <div className="flex items-start gap-2">
              <svg
                aria-hidden="true"
                className="w-5 h-5 mt-0.5"
                style={{ color: 'rgb(var(--warning))' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium" style={{ color: 'rgb(var(--warning))' }}>
                  Save this key now
                </p>
                <p className="text-sm" style={{ color: 'rgb(var(--warning) / 0.8)' }}>
                  This is the only time you will see this API key. Store it securely.
                </p>
              </div>
            </div>
          </div>
          <div>
            <span
              className="block text-sm font-medium mb-1"
              style={{ color: 'rgb(var(--foreground) / 0.8)' }}
            >
              Your API Key
            </span>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 text-sm font-mono px-3 py-2 rounded break-all"
                style={{
                  backgroundColor: 'rgb(var(--secondary))',
                  color: 'rgb(var(--foreground))',
                }}
              >
                {generatedKey}
              </code>
              <Button variant="secondary" onClick={copyToClipboard}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleCloseNewKeyModal}>Done</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
