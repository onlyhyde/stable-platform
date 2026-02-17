'use client'

import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Input,
  Modal,
  ModalActions,
  useToast,
} from '@/components/common'
import { type Guardian, useRecoveryModule } from '@/hooks/useRecoveryModule'
import { useSmartAccount } from '@/hooks/useSmartAccount'

// ============================================================================
// Helpers
// ============================================================================

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function isValidAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

// ============================================================================
// Component
// ============================================================================

export function SocialRecoveryCard() {
  const { addToast } = useToast()
  const { status } = useSmartAccount()
  const {
    config,
    isLoading,
    isInstalling,
    error,
    setupRecovery,
    addGuardian,
    removeGuardian,
    updateThreshold,
    refresh,
  } = useRecoveryModule()

  // Setup modal state
  const [showSetup, setShowSetup] = useState(false)
  const [guardianIdCounter, setGuardianIdCounter] = useState(1)
  const [setupGuardians, setSetupGuardians] = useState<
    { id: number; address: string; weight: string; label: string }[]
  >([{ id: 0, address: '', weight: '1', label: '' }])
  const [setupThreshold, setSetupThreshold] = useState('1')

  // Add guardian modal
  const [showAddGuardian, setShowAddGuardian] = useState(false)
  const [newGuardian, setNewGuardian] = useState({ address: '', weight: '1', label: '' })

  // Threshold edit
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('')

  // ============================================================================
  // Setup handlers
  // ============================================================================

  const handleAddSetupRow = useCallback(() => {
    setGuardianIdCounter((prev) => prev + 1)
    setSetupGuardians((prev) => [
      ...prev,
      { id: guardianIdCounter, address: '', weight: '1', label: '' },
    ])
  }, [guardianIdCounter])

  const handleRemoveSetupRow = useCallback((index: number) => {
    setSetupGuardians((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpdateSetupRow = useCallback(
    (index: number, field: 'address' | 'weight' | 'label', value: string) => {
      setSetupGuardians((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      )
    },
    []
  )

  const handleSetup = useCallback(async () => {
    const guardians: Guardian[] = setupGuardians
      .filter((g) => isValidAddress(g.address))
      .map((g) => ({
        address: g.address as Address,
        weight: Number.parseInt(g.weight, 10) || 1,
        label: g.label || undefined,
      }))

    if (guardians.length === 0) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Add at least one valid guardian address',
      })
      return
    }

    const threshold = Number.parseInt(setupThreshold, 10) || 1
    const totalWeight = guardians.reduce((sum, g) => sum + g.weight, 0)
    if (threshold > totalWeight) {
      addToast({
        type: 'error',
        title: 'Error',
        message: `Threshold (${threshold}) cannot exceed total weight (${totalWeight})`,
      })
      return
    }

    const success = await setupRecovery(guardians, threshold)
    if (success) {
      addToast({
        type: 'success',
        title: 'Recovery Configured',
        message: `Social recovery set up with ${guardians.length} guardian(s)`,
      })
      setShowSetup(false)
      setSetupGuardians([{ id: 0, address: '', weight: '1', label: '' }])
      setGuardianIdCounter(1)
      setSetupThreshold('1')
    } else {
      addToast({ type: 'error', title: 'Setup Failed', message: error || 'Transaction failed' })
    }
  }, [setupGuardians, setupThreshold, setupRecovery, addToast, error])

  // ============================================================================
  // Add guardian handler
  // ============================================================================

  const handleAddGuardian = useCallback(async () => {
    if (!isValidAddress(newGuardian.address)) {
      addToast({ type: 'error', title: 'Error', message: 'Invalid guardian address' })
      return
    }

    const guardian: Guardian = {
      address: newGuardian.address as Address,
      weight: Number.parseInt(newGuardian.weight, 10) || 1,
      label: newGuardian.label || undefined,
    }

    const success = await addGuardian(guardian)
    if (success) {
      addToast({
        type: 'success',
        title: 'Guardian Added',
        message: `${guardian.label || shortenAddress(guardian.address)} added as guardian`,
      })
      setShowAddGuardian(false)
      setNewGuardian({ address: '', weight: '1', label: '' })
    } else {
      addToast({ type: 'error', title: 'Failed', message: error || 'Transaction failed' })
    }
  }, [newGuardian, addGuardian, addToast, error])

  // ============================================================================
  // Remove guardian handler
  // ============================================================================

  const handleRemoveGuardian = useCallback(
    async (guardian: Guardian) => {
      const success = await removeGuardian(guardian.address)
      if (success) {
        addToast({
          type: 'success',
          title: 'Guardian Removed',
          message: `${guardian.label || shortenAddress(guardian.address)} removed`,
        })
      } else {
        addToast({ type: 'error', title: 'Failed', message: error || 'Transaction failed' })
      }
    },
    [removeGuardian, addToast, error]
  )

  // ============================================================================
  // Threshold handler
  // ============================================================================

  const handleUpdateThreshold = useCallback(async () => {
    const newThreshold = Number.parseInt(thresholdInput, 10)
    if (Number.isNaN(newThreshold) || newThreshold < 1) {
      addToast({ type: 'error', title: 'Error', message: 'Threshold must be at least 1' })
      return
    }

    const totalWeight = config.guardians.reduce((sum, g) => sum + g.weight, 0)
    if (newThreshold > totalWeight) {
      addToast({
        type: 'error',
        title: 'Error',
        message: `Threshold cannot exceed total weight (${totalWeight})`,
      })
      return
    }

    const success = await updateThreshold(newThreshold)
    if (success) {
      addToast({
        type: 'success',
        title: 'Threshold Updated',
        message: `Recovery threshold set to ${newThreshold}`,
      })
      setEditingThreshold(false)
    } else {
      addToast({ type: 'error', title: 'Failed', message: error || 'Transaction failed' })
    }
  }, [thresholdInput, config.guardians, updateThreshold, addToast, error])

  // ============================================================================
  // Render: Not Smart Account
  // ============================================================================

  if (!status.isSmartAccount) {
    return (
      <Card>
        <CardContent className="py-6">
          <CardTitle className="mb-4">Social Recovery</CardTitle>
          <CardDescription>
            Upgrade to a Smart Account to enable social recovery with trusted guardians.
          </CardDescription>
        </CardContent>
      </Card>
    )
  }

  // ============================================================================
  // Render: Not Configured
  // ============================================================================

  if (!config.isInstalled) {
    return (
      <>
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle>Social Recovery</CardTitle>
                <CardDescription className="mt-1">
                  Add trusted guardians who can help recover your account if you lose access.
                </CardDescription>
              </div>
              <StatusBadge status="Not configured" />
            </div>

            <Button onClick={() => setShowSetup(true)} disabled={isLoading}>
              Setup Recovery
            </Button>
          </CardContent>
        </Card>

        {/* Setup Modal */}
        <Modal isOpen={showSetup} onClose={() => setShowSetup(false)} title="Setup Social Recovery">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Add trusted guardians who can collectively recover your account. Each guardian has a
              weight, and recovery requires meeting the threshold.
            </p>

            {setupGuardians.map((row, index) => (
              <div
                key={row.id}
                className="space-y-2 p-3 border rounded-lg"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                    Guardian {index + 1}
                  </span>
                  {setupGuardians.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSetupRow(index)}
                      className="text-sm"
                      style={{ color: 'rgb(var(--destructive))' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <Input
                  label="Address"
                  placeholder="0x..."
                  value={row.address}
                  onChange={(e) => handleUpdateSetupRow(index, 'address', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Label (optional)"
                    placeholder="e.g., Alice"
                    value={row.label}
                    onChange={(e) => handleUpdateSetupRow(index, 'label', e.target.value)}
                  />
                  <Input
                    label="Weight"
                    type="number"
                    placeholder="1"
                    value={row.weight}
                    onChange={(e) => handleUpdateSetupRow(index, 'weight', e.target.value)}
                  />
                </div>
              </div>
            ))}

            <Button variant="secondary" onClick={handleAddSetupRow} size="sm">
              + Add Guardian
            </Button>

            <Input
              label="Recovery Threshold"
              type="number"
              placeholder="1"
              hint="Minimum combined weight needed for recovery"
              value={setupThreshold}
              onChange={(e) => setSetupThreshold(e.target.value)}
            />
          </div>

          <ModalActions>
            <Button variant="secondary" onClick={() => setShowSetup(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetup} disabled={isInstalling}>
              {isInstalling ? 'Installing...' : 'Install Module'}
            </Button>
          </ModalActions>
        </Modal>
      </>
    )
  }

  // ============================================================================
  // Render: Configured
  // ============================================================================

  const totalWeight = config.guardians.reduce((sum, g) => sum + g.weight, 0)

  return (
    <>
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Social Recovery</CardTitle>
              <CardDescription className="mt-1">
                {config.guardians.length} guardian{config.guardians.length !== 1 ? 's' : ''}{' '}
                configured &middot; Threshold: {config.threshold}/{totalWeight}
              </CardDescription>
            </div>
            <StatusBadge status="Active" variant="success" />
          </div>

          {/* Guardian List */}
          <div className="space-y-2 mb-4">
            {config.guardians.map((guardian) => (
              <div
                key={guardian.address}
                className="flex items-center justify-between p-3 border rounded-lg"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: 'rgb(var(--secondary))',
                      color: 'rgb(var(--secondary-foreground))',
                    }}
                  >
                    {guardian.weight}
                  </div>
                  <div>
                    {guardian.label && (
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'rgb(var(--foreground))' }}
                      >
                        {guardian.label}
                      </p>
                    )}
                    <p
                      className="text-xs font-mono"
                      style={{ color: 'rgb(var(--muted-foreground))' }}
                    >
                      {shortenAddress(guardian.address)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRemoveGuardian(guardian)}
                  disabled={isInstalling}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddGuardian(true)}
              disabled={isInstalling}
            >
              Add Guardian
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setThresholdInput(String(config.threshold))
                setEditingThreshold(true)
              }}
              disabled={isInstalling}
            >
              Edit Threshold
            </Button>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Guardian Modal */}
      <Modal
        isOpen={showAddGuardian}
        onClose={() => setShowAddGuardian(false)}
        title="Add Guardian"
      >
        <div className="space-y-4">
          <Input
            label="Guardian Address"
            placeholder="0x..."
            value={newGuardian.address}
            onChange={(e) => setNewGuardian((prev) => ({ ...prev, address: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Label (optional)"
              placeholder="e.g., Bob"
              value={newGuardian.label}
              onChange={(e) => setNewGuardian((prev) => ({ ...prev, label: e.target.value }))}
            />
            <Input
              label="Weight"
              type="number"
              placeholder="1"
              value={newGuardian.weight}
              onChange={(e) => setNewGuardian((prev) => ({ ...prev, weight: e.target.value }))}
            />
          </div>
        </div>
        <ModalActions>
          <Button variant="secondary" onClick={() => setShowAddGuardian(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddGuardian} disabled={isInstalling}>
            {isInstalling ? 'Adding...' : 'Add Guardian'}
          </Button>
        </ModalActions>
      </Modal>

      {/* Edit Threshold Modal */}
      <Modal
        isOpen={editingThreshold}
        onClose={() => setEditingThreshold(false)}
        title="Edit Recovery Threshold"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Total guardian weight: {totalWeight}. Threshold must be between 1 and {totalWeight}.
          </p>
          <Input
            label="New Threshold"
            type="number"
            placeholder={String(config.threshold)}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
        </div>
        <ModalActions>
          <Button variant="secondary" onClick={() => setEditingThreshold(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdateThreshold} disabled={isInstalling}>
            {isInstalling ? 'Updating...' : 'Update'}
          </Button>
        </ModalActions>
      </Modal>
    </>
  )
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({
  status,
  variant = 'default',
}: {
  status: string
  variant?: 'default' | 'success'
}) {
  const bg = variant === 'success' ? 'rgb(var(--success, 34 197 94))' : 'rgb(var(--muted))'
  const color =
    variant === 'success'
      ? 'rgb(var(--success-foreground, 255 255 255))'
      : 'rgb(var(--muted-foreground))'

  return (
    <span
      className="text-xs font-medium px-2 py-1 rounded-full"
      style={{ backgroundColor: bg, color }}
    >
      {status}
    </span>
  )
}
