import { useState, useMemo, Fragment } from 'react'
import {
  MODULE_TYPE,
  getModuleTypeName,
  type Account,
  type ModuleType,
  type ModuleRegistryEntry,
} from '@stablenet/core'

import { useModuleRegistry } from './hooks/useModuleRegistry'
import { useModuleInstall } from './hooks/useModuleInstall'
import { ModuleConfigForm } from './ModuleConfig'

// ============================================================================
// Types
// ============================================================================

type WizardStep = 'select-type' | 'select-module' | 'configure' | 'confirm' | 'pending'

interface InstallModuleWizardProps {
  account: Account
  preselectedType?: ModuleType | null
  onComplete: () => void
  onCancel: () => void
}

// ============================================================================
// Component
// ============================================================================

export function InstallModuleWizard({
  account,
  preselectedType,
  onComplete,
  onCancel,
}: InstallModuleWizardProps) {
  const [step, setStep] = useState<WizardStep>(preselectedType ? 'select-module' : 'select-type')
  const [selectedType, setSelectedType] = useState<ModuleType | null>(preselectedType ?? null)
  const [selectedModule, setSelectedModule] = useState<ModuleRegistryEntry | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)

  const { availableModules } = useModuleRegistry()
  const { installModule, isPending } = useModuleInstall()

  // Filter modules by selected type
  const filteredModules = useMemo(() => {
    if (!selectedType || !availableModules) return []
    return availableModules.filter((m) => m.metadata.type === selectedType)
  }, [selectedType, availableModules])

  // Handle type selection
  const handleTypeSelect = (type: ModuleType) => {
    setSelectedType(type)
    setStep('select-module')
  }

  // Handle module selection
  const handleModuleSelect = (module: ModuleRegistryEntry) => {
    setSelectedModule(module)
    // If module has no config, skip to confirm
    if (module.configSchema.fields.length === 0) {
      setStep('confirm')
    } else {
      setStep('configure')
    }
  }

  // Handle configuration complete
  const handleConfigComplete = (values: Record<string, unknown>) => {
    setConfigValues(values)
    setStep('confirm')
  }

  // Handle install
  const handleInstall = async () => {
    if (!selectedModule) return

    setStep('pending')
    setError(null)

    try {
      await installModule({
        account: account.address,
        module: selectedModule,
        config: configValues,
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed')
      setStep('confirm')
    }
  }

  const hasConfig = (selectedModule?.configSchema.fields.length ?? 0) > 0

  return (
    <div className="install-module-wizard">
      {/* Header */}
      <div
        className="wizard-header flex items-center justify-between p-4"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgb(var(--border))' }}
      >
        <button style={{ color: 'rgb(var(--muted-foreground))' }} onClick={onCancel}>
          ← Back
        </button>
        <h2 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          Install Module
        </h2>
        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* Progress */}
      <WizardProgress currentStep={step} hasConfig={hasConfig} />

      {/* Content */}
      <div className="wizard-content p-4">
        {/* Step: Select Type */}
        {step === 'select-type' && <TypeSelector onSelect={handleTypeSelect} />}

        {/* Step: Select Module */}
        {step === 'select-module' && selectedType && (
          <ModuleSelector
            modules={filteredModules}
            type={selectedType}
            onSelect={handleModuleSelect}
            onBack={() => setStep('select-type')}
          />
        )}

        {/* Step: Configure */}
        {step === 'configure' && selectedModule && (
          <ModuleConfigForm
            module={selectedModule}
            initialValues={configValues}
            onSubmit={handleConfigComplete}
            onBack={() => setStep('select-module')}
          />
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && selectedModule && (
          <InstallConfirmation
            module={selectedModule}
            config={configValues}
            error={error}
            onConfirm={handleInstall}
            onBack={() => setStep(hasConfig ? 'configure' : 'select-module')}
          />
        )}

        {/* Step: Pending */}
        {step === 'pending' && (
          <div className="pending-state text-center py-12">
            <div
              className="w-12 h-12 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
            />
            <p style={{ color: 'rgb(var(--foreground))' }}>Installing module...</p>
            <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              Please confirm the transaction in your wallet
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

interface WizardProgressProps {
  currentStep: WizardStep
  hasConfig: boolean
}

function WizardProgress({ currentStep, hasConfig }: WizardProgressProps) {
  const steps = ['select-type', 'select-module', ...(hasConfig ? ['configure'] : []), 'confirm']
  const currentIndex = steps.indexOf(currentStep)

  return (
    <div className="wizard-progress flex items-center justify-center gap-2 py-4">
      {steps.map((step, index) => (
        <Fragment key={step}>
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor:
                index <= currentIndex ? 'rgb(var(--primary))' : 'rgb(var(--border))',
            }}
          />
          {index < steps.length - 1 && (
            <div
              className="w-8 h-0.5"
              style={{
                backgroundColor:
                  index < currentIndex ? 'rgb(var(--primary))' : 'rgb(var(--border))',
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

interface TypeSelectorProps {
  onSelect: (type: ModuleType) => void
}

function TypeSelector({ onSelect }: TypeSelectorProps) {
  const types = [
    {
      type: MODULE_TYPE.VALIDATOR,
      icon: '🔐',
      name: 'Validator',
      description: 'Control who can sign transactions',
    },
    {
      type: MODULE_TYPE.EXECUTOR,
      icon: '⚡',
      name: 'Executor',
      description: 'Add automation and special execution logic',
    },
    {
      type: MODULE_TYPE.HOOK,
      icon: '🪝',
      name: 'Hook',
      description: 'Add pre/post transaction checks',
    },
    {
      type: MODULE_TYPE.FALLBACK,
      icon: '🔄',
      name: 'Fallback',
      description: 'Handle special function calls',
    },
  ]

  return (
    <div className="type-selector">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        What type of module?
      </h3>
      <div className="space-y-3">
        {types.map((type) => (
          <button
            key={String(type.type)}
            className="type-option w-full p-4 rounded-lg text-left transition-all"
            style={{
              backgroundColor: 'rgb(var(--card))',
              borderWidth: 1,
              borderColor: 'rgb(var(--border))',
            }}
            onClick={() => onSelect(type.type)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{type.icon}</span>
              <div>
                <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {type.name}
                </h4>
                <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {type.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface ModuleSelectorProps {
  modules: ModuleRegistryEntry[]
  type: ModuleType
  onSelect: (module: ModuleRegistryEntry) => void
  onBack: () => void
}

function ModuleSelector({ modules, type, onSelect }: ModuleSelectorProps) {
  return (
    <div className="module-selector">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        Select a {getModuleTypeName(type)}
      </h3>

      {modules.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
          No {getModuleTypeName(type).toLowerCase()}s available
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <button
              key={module.metadata.address}
              className="module-option w-full p-4 rounded-lg text-left transition-all"
              style={{
                backgroundColor: 'rgb(var(--card))',
                borderWidth: 1,
                borderColor: 'rgb(var(--border))',
              }}
              onClick={() => onSelect(module)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                      {module.metadata.name}
                    </h4>
                    {module.metadata.isVerified && (
                      <span className="text-xs" style={{ color: 'rgb(var(--success))' }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <p
                    className="text-sm mt-1"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    {module.metadata.description}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {module.metadata.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgb(var(--secondary))',
                          color: 'rgb(var(--muted-foreground))',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span style={{ color: 'rgb(var(--muted-foreground))' }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface InstallConfirmationProps {
  module: ModuleRegistryEntry
  config: Record<string, unknown>
  error: string | null
  onConfirm: () => void
  onBack: () => void
}

function InstallConfirmation({ module, config, error, onConfirm, onBack }: InstallConfirmationProps) {
  return (
    <div className="install-confirmation">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        Confirm Installation
      </h3>

      {/* Module Info */}
      <div className="module-info p-4 rounded-lg mb-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
        <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {module.metadata.name}
        </h4>
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {module.metadata.description}
        </p>
      </div>

      {/* Configuration Summary */}
      {Object.keys(config).length > 0 && (
        <div className="config-summary p-4 rounded-lg mb-4" style={{ backgroundColor: 'rgb(var(--secondary))' }}>
          <h5 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
            Configuration
          </h5>
          <dl className="text-sm space-y-1">
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <dt style={{ color: 'rgb(var(--muted-foreground))' }}>{key}:</dt>
                <dd className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                  {String(value).slice(0, 20)}
                  {String(value).length > 20 && '...'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="error-message p-3 rounded-lg mb-4"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            color: 'rgb(var(--destructive))',
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button className="btn-ghost flex-1 py-3 rounded-lg font-medium" onClick={onBack}>
          Back
        </button>
        <button className="btn-primary flex-1 py-3 rounded-lg font-medium" onClick={onConfirm}>
          Install Module
        </button>
      </div>
    </div>
  )
}
