'use client'

import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { isAddress } from 'viem'
import { Button, Input, Modal, ModalActions } from '@/components/common'
import { getModuleEntry } from '@/lib/moduleAddresses'
import type { ModuleCardData } from './ModuleCard'

// ============================================================================
// Types
// ============================================================================

interface InstallModuleModalProps {
  isOpen: boolean
  onClose: () => void
  module: ModuleCardData | null
  onInstall: (moduleId: string, initData?: Hex) => Promise<void>
  isInstalling: boolean
  isSmartAccount: boolean
  walletAddress?: Address
}

// ============================================================================
// Per-module config forms
// ============================================================================

interface ConfigFormProps {
  onInitDataChange: (data: Hex) => void
  walletAddress?: Address
}

function ECDSAValidatorForm({ onInitDataChange, walletAddress }: ConfigFormProps) {
  const [owner, setOwner] = useState<string>(walletAddress ?? '')
  const [error, setError] = useState<string>('')

  const handleChange = (value: string) => {
    setOwner(value)
    if (value && !isAddress(value)) {
      setError('Invalid address format')
      return
    }
    setError('')
    if (value && isAddress(value)) {
      onInitDataChange(value.toLowerCase() as Hex)
    }
  }

  return (
    <Input
      label="Owner Address"
      placeholder="0x..."
      value={owner}
      onChange={(e) => handleChange(e.target.value)}
      error={error}
      hint="The address authorized to sign transactions. Defaults to your connected wallet."
    />
  )
}

function MultisigValidatorForm({ onInitDataChange }: ConfigFormProps) {
  const [signers, setSigners] = useState<string>('')
  const [threshold, setThreshold] = useState<string>('2')
  const [error, setError] = useState<string>('')

  const handleSignersChange = (value: string) => {
    setSigners(value)
    encode(value, threshold)
  }

  const handleThresholdChange = (value: string) => {
    setThreshold(value)
    encode(signers, value)
  }

  const encode = (signersStr: string, thresholdStr: string) => {
    setError('')
    const signerList = signersStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (signerList.length === 0) return

    const invalidAddr = signerList.find((s) => !isAddress(s))
    if (invalidAddr) {
      setError(`Invalid address: ${invalidAddr.slice(0, 10)}...`)
      return
    }

    const t = Number.parseInt(thresholdStr, 10)
    if (Number.isNaN(t) || t < 1 || t > signerList.length) {
      setError(`Threshold must be 1-${signerList.length}`)
      return
    }

    const thresholdHex = t.toString(16).padStart(64, '0')
    const signerCountHex = signerList.length.toString(16).padStart(64, '0')
    const signersHex = signerList.map((s) => s.slice(2).toLowerCase().padStart(64, '0')).join('')
    onInitDataChange(`0x${thresholdHex}${signerCountHex}${signersHex}` as Hex)
  }

  return (
    <div className="space-y-3">
      <Input
        label="Signers (comma-separated)"
        placeholder="0xabc..., 0xdef..."
        value={signers}
        onChange={(e) => handleSignersChange(e.target.value)}
        error={error}
        hint="Addresses of all required signers"
      />
      <Input
        label="Threshold"
        type="number"
        min={1}
        placeholder="2"
        value={threshold}
        onChange={(e) => handleThresholdChange(e.target.value)}
        hint="Minimum number of signatures required"
      />
    </div>
  )
}

function SpendingLimitHookForm({ onInitDataChange }: ConfigFormProps) {
  const [token, setToken] = useState('')
  const [limit, setLimit] = useState('')
  const [period, setPeriod] = useState('86400')
  const [error, setError] = useState('')

  const encode = (tokenStr: string, limitStr: string, periodStr: string) => {
    setError('')
    if (!tokenStr || !limitStr) return

    if (!isAddress(tokenStr)) {
      setError('Invalid token address')
      return
    }

    try {
      const limitBigint = BigInt(limitStr || '0')
      const periodBigint = BigInt(periodStr || '86400')

      const tokenHex = tokenStr.slice(2).toLowerCase().padStart(64, '0')
      const limitHex = limitBigint.toString(16).padStart(64, '0')
      const periodHex = periodBigint.toString(16).padStart(64, '0')
      onInitDataChange(`0x${tokenHex}${limitHex}${periodHex}` as Hex)
    } catch {
      setError('Invalid number format')
    }
  }

  return (
    <div className="space-y-3">
      <Input
        label="Token Address"
        placeholder="0x... (use 0x0000...0000 for native token)"
        value={token}
        onChange={(e) => {
          setToken(e.target.value)
          encode(e.target.value, limit, period)
        }}
        error={error}
      />
      <Input
        label="Spending Limit (wei)"
        type="text"
        placeholder="1000000000000000000"
        value={limit}
        onChange={(e) => {
          setLimit(e.target.value)
          encode(token, e.target.value, period)
        }}
        hint="Maximum amount per period in wei"
      />
      <Input
        label="Period (seconds)"
        type="text"
        placeholder="86400"
        value={period}
        onChange={(e) => {
          setPeriod(e.target.value)
          encode(token, limit, e.target.value)
        }}
        hint="Reset period in seconds (86400 = 1 day)"
      />
    </div>
  )
}

function DefaultInitDataForm({ onInitDataChange }: ConfigFormProps) {
  const [rawData, setRawData] = useState('0x')
  const [error, setError] = useState('')

  const handleChange = (value: string) => {
    setRawData(value)
    if (value && !/^0x[0-9a-fA-F]*$/.test(value)) {
      setError('Invalid hex format (must start with 0x)')
      return
    }
    setError('')
    onInitDataChange((value || '0x') as Hex)
  }

  return (
    <Input
      label="Init Data (hex)"
      placeholder="0x"
      value={rawData}
      onChange={(e) => handleChange(e.target.value)}
      error={error}
      hint="Raw hex-encoded initialization data. Leave as 0x for default."
    />
  )
}

// ============================================================================
// Module type display name map
// ============================================================================

const moduleTypeLabelMap: Record<string, string> = {
  validator: 'Validator',
  executor: 'Executor',
  hook: 'Hook',
  fallback: 'Fallback',
}

// ============================================================================
// Main Component
// ============================================================================

export function InstallModuleModal({
  isOpen,
  onClose,
  module,
  onInstall,
  isInstalling,
  isSmartAccount,
  walletAddress,
}: InstallModuleModalProps) {
  const [initData, setInitData] = useState<Hex>('0x')

  const handleInstall = useCallback(async () => {
    if (!module) return
    await onInstall(module.id, initData)
  }, [module, initData, onInstall])

  const handleClose = useCallback(() => {
    if (!isInstalling) {
      setInitData('0x')
      onClose()
    }
  }, [isInstalling, onClose])

  if (!module) return null

  const entry = getModuleEntry(module.id)

  const renderConfigForm = () => {
    const formProps: ConfigFormProps = {
      onInitDataChange: setInitData,
      walletAddress,
    }

    switch (module.id) {
      case 'ecdsa-validator':
        return <ECDSAValidatorForm {...formProps} />
      case 'multisig-validator':
        return <MultisigValidatorForm {...formProps} />
      case 'spending-limit-hook':
        return <SpendingLimitHookForm {...formProps} />
      case 'session-key-validator':
      case 'subscription-executor':
      case 'social-recovery':
      case 'dex-swap-executor':
      case 'stealth-address-fallback':
        return <DefaultInitDataForm {...formProps} />
      default:
        return <DefaultInitDataForm {...formProps} />
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Install ${module.name}`} size="md">
      {/* Module summary */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: 'rgb(var(--info) / 0.1)',
              color: 'rgb(var(--info))',
            }}
          >
            {moduleTypeLabelMap[module.moduleType] ?? module.moduleType}
          </span>
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            v{module.version}
          </span>
          <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
            by {module.author}
          </span>
        </div>

        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {module.description}
        </p>

        {entry && (
          <div
            className="text-xs font-mono p-2 rounded-lg truncate"
            style={{
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--muted-foreground))',
            }}
          >
            Contract: {entry.address}
          </div>
        )}

        {/* Smart Account warning */}
        {!isSmartAccount && (
          <div
            className="p-3 rounded-xl text-sm"
            style={{
              backgroundColor: 'rgb(var(--warning) / 0.1)',
              color: 'rgb(var(--warning))',
            }}
          >
            Your account is not a Smart Account. Please upgrade via the Settings page before
            installing modules.
          </div>
        )}

        {/* Config form */}
        {isSmartAccount && (
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ backgroundColor: 'rgb(var(--background))' }}
          >
            <h4 className="text-sm font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              Configuration
            </h4>
            {renderConfigForm()}
          </div>
        )}
      </div>

      <ModalActions>
        <Button variant="secondary" onClick={handleClose} disabled={isInstalling}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleInstall}
          isLoading={isInstalling}
          disabled={!isSmartAccount || isInstalling}
        >
          {isInstalling ? 'Installing...' : 'Install Module'}
        </Button>
      </ModalActions>
    </Modal>
  )
}
