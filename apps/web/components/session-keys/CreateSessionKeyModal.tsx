'use client'

import { type FC, useCallback, useState } from 'react'
import type { Address, Hash, Hex } from 'viem'
import { isAddress, parseUnits } from 'viem'
import type { CreateSessionKeyParams } from '../../hooks/useSessionKey'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'

interface CreateSessionKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (params: CreateSessionKeyParams) => Promise<{
    sessionKey: Address
    txHash: Hash
  } | null>
  isCreating?: boolean
}

type ExpiryOption = '1h' | '24h' | '7d' | '30d' | 'never' | 'custom'

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string; seconds: number }[] = [
  { value: '1h', label: '1 hour', seconds: 3600 },
  { value: '24h', label: '24 hours', seconds: 86400 },
  { value: '7d', label: '7 days', seconds: 604800 },
  { value: '30d', label: '30 days', seconds: 2592000 },
  { value: 'never', label: 'No expiry', seconds: 0 },
]

interface PermissionInput {
  target: string
  selector: string
}

export const CreateSessionKeyModal: FC<CreateSessionKeyModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isCreating = false,
}) => {
  const [step, setStep] = useState<'configure' | 'permissions' | 'confirm' | 'success'>('configure')
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('24h')
  const [customExpiry, setCustomExpiry] = useState<string>('')
  const [spendingLimit, setSpendingLimit] = useState<string>('')
  const [permissions, setPermissions] = useState<PermissionInput[]>([])
  const [newPermission, setNewPermission] = useState<PermissionInput>({ target: '', selector: '' })

  // Result state
  const [createdSessionKey, setCreatedSessionKey] = useState<Address | null>(null)
  const [txHash, setTxHash] = useState<Hash | null>(null)

  const resetForm = useCallback(() => {
    setStep('configure')
    setError(null)
    setExpiryOption('24h')
    setCustomExpiry('')
    setSpendingLimit('')
    setPermissions([])
    setNewPermission({ target: '', selector: '' })
    setCreatedSessionKey(null)
    setTxHash(null)
  }, [])

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const calculateExpiry = (): bigint => {
    if (expiryOption === 'never') return BigInt(0)

    const option = EXPIRY_OPTIONS.find((o) => o.value === expiryOption)
    if (option) {
      return BigInt(Math.floor(Date.now() / 1000) + option.seconds)
    }

    if (expiryOption === 'custom' && customExpiry) {
      const date = new Date(customExpiry)
      return BigInt(Math.floor(date.getTime() / 1000))
    }

    return BigInt(0)
  }

  const handleAddPermission = () => {
    if (!newPermission.target || !newPermission.selector) {
      setError('Please enter both target address and function selector')
      return
    }

    if (!isAddress(newPermission.target)) {
      setError('Invalid target address')
      return
    }

    if (!/^0x[0-9a-fA-F]{8}$/.test(newPermission.selector)) {
      setError('Invalid function selector (must be 4 bytes, e.g., 0x12345678)')
      return
    }

    setPermissions([...permissions, newPermission])
    setNewPermission({ target: '', selector: '' })
    setError(null)
  }

  const handleRemovePermission = (index: number) => {
    setPermissions(permissions.filter((_, i) => i !== index))
  }

  const handleCreate = async () => {
    setError(null)

    try {
      const params: CreateSessionKeyParams = {
        expiry: calculateExpiry(),
        spendingLimit: spendingLimit ? parseUnits(spendingLimit, 18) : BigInt(0),
        permissions: permissions.map((p) => ({
          target: p.target as Address,
          selector: p.selector as Hex,
        })),
      }

      const result = await onCreate(params)

      if (result) {
        setCreatedSessionKey(result.sessionKey)
        setTxHash(result.txHash)
        setStep('success')
      } else {
        setError('Failed to create session key')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session key')
    }
  }

  const handleNext = () => {
    if (step === 'configure') {
      setStep('permissions')
    } else if (step === 'permissions') {
      setStep('confirm')
    }
  }

  const handleBack = () => {
    if (step === 'permissions') {
      setStep('configure')
    } else if (step === 'confirm') {
      setStep('permissions')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'success' ? 'Session Key Created!' : 'Create Session Key'}
      size="md"
    >
      <div className="space-y-6">
        {/* Step indicator */}
        {step !== 'success' && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {['configure', 'permissions', 'confirm'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{
                    backgroundColor:
                      step === s
                        ? 'rgb(var(--primary))'
                        : ['configure', 'permissions', 'confirm'].indexOf(step) > i
                          ? 'rgb(var(--success))'
                          : 'rgb(var(--secondary))',
                    color:
                      step === s || ['configure', 'permissions', 'confirm'].indexOf(step) > i
                        ? 'white'
                        : 'rgb(var(--muted-foreground))',
                  }}
                >
                  {['configure', 'permissions', 'confirm'].indexOf(step) > i ? '✓' : i + 1}
                </div>
                {i < 2 && (
                  <div
                    className="w-12 h-1 mx-1 rounded"
                    style={{
                      backgroundColor:
                        ['configure', 'permissions', 'confirm'].indexOf(step) > i
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--secondary))',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Configure */}
        {step === 'configure' && (
          <div className="space-y-4">
            {/* Expiry */}
            <div>
              <span
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                Expiry
              </span>
              <div className="grid grid-cols-3 gap-2">
                {EXPIRY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExpiryOption(option.value)}
                    className="px-3 py-2 text-sm rounded-lg border transition-colors hover:opacity-80"
                    style={{
                      borderColor:
                        expiryOption === option.value
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--border))',
                      backgroundColor:
                        expiryOption === option.value ? 'rgb(var(--primary) / 0.1)' : 'transparent',
                      color:
                        expiryOption === option.value
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--muted-foreground))',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setExpiryOption('custom')}
                  className="px-3 py-2 text-sm rounded-lg border transition-colors hover:opacity-80"
                  style={{
                    borderColor:
                      expiryOption === 'custom' ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                    backgroundColor:
                      expiryOption === 'custom' ? 'rgb(var(--primary) / 0.1)' : 'transparent',
                    color:
                      expiryOption === 'custom'
                        ? 'rgb(var(--primary))'
                        : 'rgb(var(--muted-foreground))',
                  }}
                >
                  Custom
                </button>
              </div>
              {expiryOption === 'custom' && (
                <input
                  type="datetime-local"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{ borderColor: 'rgb(var(--border))' }}
                />
              )}
            </div>

            {/* Spending Limit */}
            <div>
              <span
                className="block text-sm font-medium mb-2"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                Spending Limit (ETH)
              </span>
              <input
                type="text"
                placeholder="0 = unlimited"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none"
                style={{ borderColor: 'rgb(var(--border))' }}
              />
              <p className="mt-1 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                Leave empty or set to 0 for unlimited spending
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Permissions */}
        {step === 'permissions' && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Add permissions to restrict which contracts and functions this session key can call.
            </p>

            {/* Existing permissions */}
            {permissions.length > 0 && (
              <div className="space-y-2">
                {permissions.map((perm, idx) => (
                  <div
                    key={`${perm.target}-${perm.selector}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: 'rgb(var(--secondary))' }}
                  >
                    <div className="font-mono text-xs">
                      <div style={{ color: 'rgb(var(--foreground))' }}>
                        {perm.target.slice(0, 10)}...
                      </div>
                      <div style={{ color: 'rgb(var(--muted-foreground))' }}>{perm.selector}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePermission(idx)}
                      className="hover:opacity-80"
                      style={{ color: 'rgb(var(--destructive))' }}
                    >
                      <svg
                        aria-hidden="true"
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add permission */}
            <div
              className="space-y-2 p-3 rounded-lg"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <input
                type="text"
                placeholder="Target contract address (0x...)"
                value={newPermission.target}
                onChange={(e) => setNewPermission({ ...newPermission, target: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none text-sm"
                style={{ borderColor: 'rgb(var(--border))' }}
              />
              <input
                type="text"
                placeholder="Function selector (e.g., 0x12345678)"
                value={newPermission.selector}
                onChange={(e) => setNewPermission({ ...newPermission, selector: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none text-sm"
                style={{ borderColor: 'rgb(var(--border))' }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddPermission}
                className="w-full"
              >
                Add Permission
              </Button>
            </div>

            <p className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {permissions.length === 0
                ? 'No permissions added. The session key will have full access.'
                : `${permissions.length} permission(s) configured.`}
            </p>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div
              className="rounded-lg p-4 space-y-3"
              style={{ backgroundColor: 'rgb(var(--secondary))' }}
            >
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Expiry</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>
                  {expiryOption === 'never'
                    ? 'No expiry'
                    : expiryOption === 'custom'
                      ? new Date(customExpiry).toLocaleString()
                      : EXPIRY_OPTIONS.find((o) => o.value === expiryOption)?.label}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Spending Limit</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>
                  {spendingLimit ? `${spendingLimit} ETH` : 'Unlimited'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>Permissions</span>
                <span style={{ color: 'rgb(var(--foreground))' }}>
                  {permissions.length === 0
                    ? 'Full access'
                    : `${permissions.length} restriction(s)`}
                </span>
              </div>
            </div>

            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
              <p className="text-sm text-yellow-700">
                <strong>Warning:</strong> This session key will be able to sign transactions on
                behalf of your account within the configured limits.
              </p>
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="text-center py-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
            >
              <svg
                aria-hidden="true"
                className="w-8 h-8"
                style={{ color: 'rgb(var(--success))' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
              Session Key Created!
            </h3>
            <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Your new session key is ready to use.
            </p>
            {createdSessionKey && (
              <div
                className="rounded-lg p-3 mb-4"
                style={{ backgroundColor: 'rgb(var(--secondary))' }}
              >
                <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Session Key Address
                </p>
                <p
                  className="font-mono text-sm break-all"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  {createdSessionKey}
                </p>
              </div>
            )}
            {txHash && (
              <div
                className="rounded-lg p-3 mb-4"
                style={{ backgroundColor: 'rgb(var(--secondary))' }}
              >
                <p className="text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Transaction Hash
                </p>
                <p
                  className="font-mono text-xs break-all"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  {txHash}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-lg p-3 text-sm"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              borderWidth: '1px',
              borderColor: 'rgb(var(--destructive) / 0.2)',
              color: 'rgb(var(--destructive))',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {step !== 'success' && (
            <>
              {step !== 'configure' ? (
                <Button variant="secondary" className="flex-1" onClick={handleBack}>
                  Back
                </Button>
              ) : (
                <Button variant="secondary" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
              )}
              {step !== 'confirm' ? (
                <Button variant="primary" className="flex-1" onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleCreate}
                  isLoading={isCreating}
                >
                  Create Session Key
                </Button>
              )}
            </>
          )}
          {step === 'success' && (
            <Button variant="primary" className="flex-1" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default CreateSessionKeyModal
