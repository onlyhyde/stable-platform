'use client'

import { useState, useCallback, useMemo } from 'react'
import { Input, Button } from '@/components/common'
import { cn } from '@/lib/utils'
import { formatAddress } from '@/lib/utils'
import {
  getDelegatePresets,
  isValidAddress,
  ZERO_ADDRESS,
  type DelegatePreset,
} from '@/lib/eip7702'
import type { Address } from 'viem'

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
            mode === 'preset'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          Preset Contracts
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('custom')}
          disabled={disabled}
          className={cn(
            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
            mode === 'custom'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
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
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-sm text-yellow-700">
                No preset contracts available for this network.
                Please use a custom address.
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
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Selected Delegate:</span>
          <span className="font-mono text-sm text-gray-900">
            {formatAddress(value, 8)}
          </span>
        </div>
        {selectedPreset && (
          <p className="text-xs text-gray-500 mt-1">
            {selectedPreset.name} - {selectedPreset.description}
          </p>
        )}
        {value === ZERO_ADDRESS && (
          <p className="text-xs text-orange-600 mt-1">
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
        'w-full p-4 rounded-lg border-2 text-left transition-all',
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">{preset.name}</h4>
            {selected && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                Selected
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{preset.description}</p>
          <p className="font-mono text-xs text-gray-400 mt-2">
            {formatAddress(preset.address, 8)}
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {preset.features.map((feature) => (
          <span
            key={feature}
            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  )
}
