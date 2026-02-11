'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { Button, Input } from '@/components/common'
import {
  type DelegatePreset,
  getDelegatePresets,
  isValidAddress,
  ZERO_ADDRESS,
} from '@/lib/eip7702'
import { cn, formatAddress } from '@/lib/utils'

interface DelegateAddressInputProps {
  chainId: number
  value: Address
  onChange: (address: Address) => void
  disabled?: boolean
  className?: string
}

type InputMode = 'preset' | 'custom'

export function DelegateAddressInput({
  chainId,
  value,
  onChange,
  disabled = false,
  className,
}: DelegateAddressInputProps) {
  const [mode, setMode] = useState<InputMode>('preset')
  const [customAddress, setCustomAddress] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const presets = useMemo(() => getDelegatePresets(chainId), [chainId])

  const selectedPreset = useMemo(() => {
    return presets.find((p) => p.address.toLowerCase() === value.toLowerCase())
  }, [presets, value])

  const handlePresetSelect = useCallback(
    (address: Address) => {
      setValidationError(null)
      onChange(address)
    },
    [onChange]
  )

  const handleCustomAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const addr = e.target.value
      setCustomAddress(addr)

      if (!addr) {
        setValidationError(null)
        return
      }

      if (!isValidAddress(addr)) {
        setValidationError('Invalid address format')
        return
      }

      setValidationError(null)
      onChange(addr as Address)
    },
    [onChange]
  )

  const handleModeSwitch = useCallback(
    (newMode: InputMode) => {
      setMode(newMode)
      setValidationError(null)

      if (newMode === 'preset' && presets.length > 0) {
        onChange(presets[0].address)
        setCustomAddress('')
      } else if (newMode === 'custom') {
        setCustomAddress(value !== presets[0]?.address ? value : '')
      }
    },
    [presets, value, onChange]
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeSwitch('preset')}
          disabled={disabled}
          className={cn(
            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{
            backgroundColor:
              mode === 'preset' ? 'rgb(var(--primary) / 0.1)' : 'rgb(var(--secondary))',
            color: mode === 'preset' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: mode === 'preset' ? 'rgb(var(--primary))' : 'transparent',
          }}
        >
          Preset Contracts
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('custom')}
          disabled={disabled}
          className={cn(
            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{
            backgroundColor:
              mode === 'custom' ? 'rgb(var(--primary) / 0.1)' : 'rgb(var(--secondary))',
            color: mode === 'custom' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: mode === 'custom' ? 'rgb(var(--primary))' : 'transparent',
          }}
        >
          Custom Address
        </button>
      </div>

      {/* Preset Selection */}
      {mode === 'preset' && (
        <div className="space-y-2">
          {presets.length > 0 ? (
            presets.map((preset) => (
              <PresetCard
                key={preset.address}
                preset={preset}
                selected={value.toLowerCase() === preset.address.toLowerCase()}
                onSelect={() => handlePresetSelect(preset.address)}
                disabled={disabled}
              />
            ))
          ) : (
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: 'rgb(var(--warning) / 0.1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgb(var(--warning) / 0.3)',
              }}
            >
              <p className="text-sm" style={{ color: 'rgb(var(--warning))' }}>
                No preset contracts available for this network. Please use a custom address.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Custom Address Input */}
      {mode === 'custom' && (
        <div className="space-y-3">
          <Input
            label="Delegate Contract Address"
            placeholder="0x..."
            value={customAddress}
            onChange={handleCustomAddressChange}
            error={validationError || undefined}
            disabled={disabled}
            hint="Enter the address of the smart contract to delegate to"
          />

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCustomAddress(ZERO_ADDRESS)
                setValidationError(null)
                onChange(ZERO_ADDRESS)
              }}
              disabled={disabled}
              className="text-xs"
            >
              Use Zero Address (Revoke)
            </Button>
          </div>
        </div>
      )}

      {/* Selected Address Display */}
      <div
        className="p-3 rounded-lg"
        style={{
          backgroundColor: 'rgb(var(--secondary))',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'rgb(var(--border))',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Selected Delegate:
          </span>
          <span className="font-mono text-sm" style={{ color: 'rgb(var(--foreground))' }}>
            {formatAddress(value, 8)}
          </span>
        </div>
        {selectedPreset && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {selectedPreset.name} - {selectedPreset.description}
          </p>
        )}
        {value === ZERO_ADDRESS && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--warning))' }}>
            Zero address selected - This will revoke the delegation
          </p>
        )}
      </div>
    </div>
  )
}

// Preset Card Sub-component
interface PresetCardProps {
  preset: DelegatePreset
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}

function PresetCard({ preset, selected, onSelect, disabled }: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-lg text-left transition-all',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={{
        backgroundColor: selected ? 'rgb(var(--primary) / 0.1)' : 'rgb(var(--card))',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: selected ? 'rgb(var(--primary))' : 'rgb(var(--border))',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
              {preset.name}
            </h4>
            {selected && (
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: 'rgb(var(--primary) / 0.1)',
                  color: 'rgb(var(--primary))',
                }}
              >
                Selected
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {preset.description}
          </p>
          <p
            className="font-mono text-xs mt-2"
            style={{ color: 'rgb(var(--muted-foreground) / 0.7)' }}
          >
            {formatAddress(preset.address, 8)}
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {preset.features.map((feature) => (
          <span
            key={feature}
            className="px-2 py-0.5 text-xs rounded-full"
            style={{
              backgroundColor: 'rgb(var(--secondary))',
              color: 'rgb(var(--muted-foreground))',
            }}
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  )
}
