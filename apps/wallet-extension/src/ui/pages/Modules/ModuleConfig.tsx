import type { ModuleConfigField, ModuleRegistryEntry } from '@stablenet/core'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

// ============================================================================
// Types
// ============================================================================

interface ModuleConfigFormProps {
  module: ModuleRegistryEntry
  initialValues: Record<string, unknown>
  onSubmit: (values: Record<string, unknown>) => void
  onBack: () => void
}

// ============================================================================
// Component
// ============================================================================

export function ModuleConfigForm({
  module,
  initialValues,
  onSubmit,
  onBack,
}: ModuleConfigFormProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const [values, setValues] = useState<Record<string, unknown>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = useCallback((field: ModuleConfigField, value: unknown) => {
    setValues((prev) => ({ ...prev, [field.name]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field.name]
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {}

    // Validate required fields
    for (const field of module.configSchema.fields) {
      if (field.required && !values[field.name]) {
        newErrors[field.name] = `${field.label} is required`
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSubmit(values)
  }, [module, values, onSubmit])

  return (
    <div className="module-config-form">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        {t('configure', { name: module.metadata.name })}
      </h3>

      <div className="space-y-4">
        {module.configSchema.fields.map((field) => (
          <ConfigField
            key={field.name}
            field={field}
            value={values[field.name]}
            error={errors[field.name]}
            onChange={(value) => handleChange(field, value)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          className="btn-ghost flex-1 py-3 rounded-lg font-medium"
          onClick={onBack}
        >
          {tc('back')}
        </button>
        <button
          type="button"
          className="btn-primary flex-1 py-3 rounded-lg font-medium"
          onClick={handleSubmit}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ConfigFieldProps {
  field: ModuleConfigField
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}

function ConfigField({ field, value, error, onChange }: ConfigFieldProps) {
  const renderInput = () => {
    switch (field.type) {
      case 'address':
        return (
          <input
            id={`config-field-${field.name}`}
            type="text"
            className="w-full px-3 py-2 rounded-lg input-base font-mono"
            placeholder="0x..."
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )

      case 'uint256':
      case 'uint64':
      case 'uint32':
        return (
          <input
            id={`config-field-${field.name}`}
            type="text"
            className="w-full px-3 py-2 rounded-lg input-base"
            placeholder="0"
            value={(value as string) ?? ''}
            onChange={(e) => {
              // Allow only numbers
              if (e.target.value === '' || /^\d+$/.test(e.target.value)) {
                onChange(e.target.value)
              }
            }}
          />
        )

      case 'bool':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4"
            />
            <span style={{ color: 'rgb(var(--foreground))' }}>{field.label}</span>
          </label>
        )

      case 'bytes':
      case 'bytes32':
        return (
          <textarea
            id={`config-field-${field.name}`}
            className="w-full px-3 py-2 rounded-lg input-base font-mono text-sm"
            placeholder="0x..."
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
        )

      case 'address[]':
        return <AddressArrayInput value={(value as string[]) ?? []} onChange={onChange} />

      default:
        return (
          <input
            id={`config-field-${field.name}`}
            type="text"
            className="w-full px-3 py-2 rounded-lg input-base"
            placeholder={field.description}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )
    }
  }

  return (
    <div className="config-field">
      {field.type !== 'bool' && (
        <label
          htmlFor={`config-field-${field.name}`}
          className="block text-sm font-medium mb-1"
          style={{ color: 'rgb(var(--foreground-secondary))' }}
        >
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {field.description && (
        <p className="text-xs mb-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {field.description}
        </p>
      )}
      {renderInput()}
      {error && (
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
          {error}
        </p>
      )}
    </div>
  )
}

interface AddressArrayInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

function AddressArrayInput({ value, onChange }: AddressArrayInputProps) {
  const { t } = useTranslation('modules')

  const handleAdd = () => {
    onChange([...value, ''])
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleChange = (index: number, newValue: string) => {
    const newArray = [...value]
    newArray[index] = newValue
    onChange(newArray)
  }

  return (
    <div className="address-array-input space-y-2">
      {value.map((addr, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: editable dynamic form inputs have no stable identifier
        <div key={index} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 rounded-lg input-base font-mono text-sm"
            placeholder="0x..."
            value={addr}
            onChange={(e) => handleChange(index, e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              color: 'rgb(var(--destructive))',
            }}
            onClick={() => handleRemove(index)}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm"
        style={{ color: 'rgb(var(--primary))' }}
        onClick={handleAdd}
      >
        {t('addAddress')}
      </button>
    </div>
  )
}
