import {
  type Account,
  GAS_PAYMENT_TYPE,
  type GasPaymentConfig,
  getModuleTypeName,
  MODULE_TYPE,
  type ModuleRegistryEntry,
  type ModuleType,
  type MultiSigValidatorConfig,
  type SessionKeyConfig,
  type SpendingLimitHookConfig,
  type WebAuthnValidatorConfig,
} from '@stablenet/core'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Address, Hash, Hex } from 'viem'
import { formatEther, isAddress } from 'viem'
import { GasPaymentSelector } from '../Send/GasPayment'
import { useModuleInstall } from './hooks/useModuleInstall'
import { useModuleRegistry } from './hooks/useModuleRegistry'
import { saveWebAuthnCredential } from './hooks/useWebAuthn'
import { LendingExecutorConfigUI } from './LendingExecutorConfig'
import { ModuleConfigForm } from './ModuleConfig'
import { MultiSigConfigUI } from './MultiSigConfig'
import { RecurringPaymentConfigUI } from './RecurringPaymentConfig'
import { SessionKeyConfigUI } from './SessionKeyConfig'
import { SpendingLimitConfigUI } from './SpendingLimitConfig'
import { StakingExecutorConfigUI } from './StakingExecutorConfig'
import { SwapExecutorConfigUI } from './SwapExecutorConfig'
import { WebAuthnConfig } from './WebAuthnConfig'

// ============================================================================
// Types
// ============================================================================

type WizardStep =
  | 'select-type'
  | 'select-module'
  | 'configure'
  | 'custom-address'
  | 'confirm'
  | 'pending'
  | 'confirming'
  | 'success'

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
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')
  const [step, setStep] = useState<WizardStep>(preselectedType ? 'select-module' : 'select-type')
  const [selectedType, setSelectedType] = useState<ModuleType | null>(preselectedType ?? null)
  const [selectedModule, setSelectedModule] = useState<ModuleRegistryEntry | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({})
  const [customInitData, setCustomInitData] = useState<Hex | null>(null)
  const [customAddress, setCustomAddress] = useState('')
  const [customType, setCustomType] = useState<ModuleType | null>(null)
  const [customName, setCustomName] = useState('')
  const [customAddrInitData, setCustomAddrInitData] = useState<Hex>('0x')
  const [gasPayment, setGasPayment] = useState<GasPaymentConfig>({
    type: GAS_PAYMENT_TYPE.SPONSOR,
  })
  const [error, setError] = useState<string | null>(null)
  const [userOpHash, setUserOpHash] = useState<Hash | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { availableModules } = useModuleRegistry()
  const { installModule, installCustomModule } = useModuleInstall()

  // Poll for UserOp receipt and status while confirming
  const pollReceipt = useCallback(async (hash: Hash) => {
    try {
      // Check receipt first (on-chain confirmation)
      const receiptResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `receipt-poll-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [hash],
        },
      })
      if (receiptResponse?.payload?.result) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        if (receiptResponse.payload.result.success === false) {
          setError(t('operationReverted', 'Transaction reverted on-chain'))
          setStep('confirm')
        } else {
          setStep('success')
        }
        return
      }

      // Check bundler status (detect pre-chain failures like bundle revert)
      const statusResponse = await chrome.runtime.sendMessage({
        type: 'RPC_REQUEST',
        id: `status-poll-${Date.now()}`,
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'debug_bundler_getUserOperationStatus',
          params: [hash],
        },
      })
      const opStatus = statusResponse?.payload?.result
      if (opStatus && (opStatus.status === 'failed' || opStatus.status === 'dropped')) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setError(opStatus.error ?? t('operationFailed', 'Operation failed during bundling'))
        setUserOpHash(null)
        setStep('confirm')
      }
    } catch {
      // Silently continue polling
    }
  }, [t])

  useEffect(() => {
    if (step !== 'confirming' || !userOpHash) return

    // Initial poll
    pollReceipt(userOpHash)
    pollingRef.current = setInterval(() => pollReceipt(userOpHash), 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [step, userOpHash, pollReceipt])

  // Filter modules by selected type
  const filteredModules = useMemo(() => {
    if (!selectedType || !availableModules) return []
    return availableModules.filter((m) => m.metadata.type === selectedType)
  }, [selectedType, availableModules])

  // Check if selected module is WebAuthn validator
  const isWebAuthnValidator = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return name.includes('webauthn') || name.includes('passkey')
  }, [selectedModule])

  // Check if selected module is Session Key executor
  const isSessionKeyExecutor = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return name.includes('session') && (name.includes('key') || name.includes('executor'))
  }, [selectedModule])

  // Check if selected module is Spending Limit hook
  const isSpendingLimitHook = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return name.includes('spending') && (name.includes('limit') || name.includes('hook'))
  }, [selectedModule])

  // Check if selected module is MultiSig validator
  const isMultiSigValidator = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return (
      name.includes('multisig') ||
      name.includes('multi-sig') ||
      (name.includes('multi') && name.includes('sig'))
    )
  }, [selectedModule])

  // Check if selected module is Swap executor
  const isSwapExecutor = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return (
      name.includes('swap') &&
      (name.includes('executor') || selectedModule.metadata.type === MODULE_TYPE.EXECUTOR)
    )
  }, [selectedModule])

  // Check if selected module is Lending executor
  const isLendingExecutor = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return (
      (name.includes('lending') || name.includes('lend') || name.includes('borrow')) &&
      (name.includes('executor') || selectedModule.metadata.type === MODULE_TYPE.EXECUTOR)
    )
  }, [selectedModule])

  // Check if selected module is Staking executor
  const isStakingExecutor = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return (
      (name.includes('staking') || name.includes('stake')) &&
      (name.includes('executor') || selectedModule.metadata.type === MODULE_TYPE.EXECUTOR)
    )
  }, [selectedModule])

  // Check if selected module is Recurring Payment executor
  const isRecurringPaymentExecutor = useMemo(() => {
    if (!selectedModule) return false
    const name = selectedModule.metadata.name.toLowerCase()
    return (
      (name.includes('recurring') || name.includes('subscription') || name.includes('payment')) &&
      (name.includes('executor') || selectedModule.metadata.type === MODULE_TYPE.EXECUTOR)
    )
  }, [selectedModule])

  // Handle type selection
  const handleTypeSelect = (type: ModuleType) => {
    setSelectedType(type)
    setStep('select-module')
  }

  // Handle module selection
  const handleModuleSelect = (module: ModuleRegistryEntry) => {
    setSelectedModule(module)
    setCustomInitData(null) // Reset custom init data

    // Check for special module types that need custom config UIs
    const moduleName = module.metadata.name.toLowerCase()
    const isWebAuthn = moduleName.includes('webauthn') || moduleName.includes('passkey')
    const isSessionKey =
      moduleName.includes('session') &&
      (moduleName.includes('key') || moduleName.includes('executor'))
    const isSpendingLimit =
      moduleName.includes('spending') &&
      (moduleName.includes('limit') || moduleName.includes('hook'))
    const isMultiSig =
      moduleName.includes('multisig') ||
      moduleName.includes('multi-sig') ||
      (moduleName.includes('multi') && moduleName.includes('sig'))
    const isSwap =
      moduleName.includes('swap') &&
      (moduleName.includes('executor') || module.metadata.type === MODULE_TYPE.EXECUTOR)
    const isLending =
      (moduleName.includes('lending') ||
        moduleName.includes('lend') ||
        moduleName.includes('borrow')) &&
      (moduleName.includes('executor') || module.metadata.type === MODULE_TYPE.EXECUTOR)
    const isStaking =
      (moduleName.includes('staking') || moduleName.includes('stake')) &&
      (moduleName.includes('executor') || module.metadata.type === MODULE_TYPE.EXECUTOR)
    const isRecurring =
      (moduleName.includes('recurring') ||
        moduleName.includes('subscription') ||
        moduleName.includes('payment')) &&
      (moduleName.includes('executor') || module.metadata.type === MODULE_TYPE.EXECUTOR)

    if (
      isWebAuthn ||
      isSessionKey ||
      isSpendingLimit ||
      isMultiSig ||
      isSwap ||
      isLending ||
      isStaking ||
      isRecurring
    ) {
      // Special modules need custom config UI
      setStep('configure')
    } else if (module.configSchema.fields.length === 0) {
      // No config needed, skip to confirm
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

  // Handle WebAuthn config complete
  const handleWebAuthnComplete = async (initData: Hex, config: WebAuthnValidatorConfig) => {
    setCustomInitData(initData)
    setConfigValues({
      pubKeyX: config.pubKeyX.toString(),
      pubKeyY: config.pubKeyY.toString(),
      credentialId: config.credentialId,
    })

    // Save credential to storage for later use
    await saveWebAuthnCredential(account.address, {
      id: `webauthn_${Date.now()}`,
      credentialId: config.credentialId,
      pubKeyX: config.pubKeyX,
      pubKeyY: config.pubKeyY,
      createdAt: new Date().toISOString(),
    })

    setStep('confirm')
  }

  // Handle Session Key config complete
  const handleSessionKeyComplete = (initData: Hex, config: SessionKeyConfig) => {
    setCustomInitData(initData)
    setConfigValues({
      sessionKey: config.sessionKey,
      allowedTargets: config.allowedTargets.join(', '),
      allowedSelectors: config.allowedSelectors.join(', '),
      maxValuePerTx: config.maxValuePerTx.toString(),
      validAfter: new Date(config.validAfter * 1000).toISOString(),
      validUntil: new Date(config.validUntil * 1000).toISOString(),
    })

    setStep('confirm')
  }

  // Handle Spending Limit config complete
  const handleSpendingLimitComplete = (initData: Hex, config: SpendingLimitHookConfig) => {
    setCustomInitData(initData)
    setConfigValues({
      token: config.token,
      limit: formatEther(config.limit),
      period: `${config.period} seconds`,
    })

    setStep('confirm')
  }

  // Handle MultiSig config complete
  const handleMultiSigComplete = (initData: Hex, config: MultiSigValidatorConfig) => {
    setCustomInitData(initData)
    setConfigValues({
      signers: config.signers.map((s) => `${s.slice(0, 8)}...${s.slice(-6)}`).join(', '),
      threshold: `${config.threshold} of ${config.signers.length}`,
    })

    setStep('confirm')
  }

  // Handle DeFi executor config complete (generic handler for Swap, Lending, Staking, Recurring)
  const handleDefiExecutorComplete = (initData: Hex) => {
    setCustomInitData(initData)
    // Config values are displayed from the initData encoding
    setConfigValues({ configured: 'true' })
    setStep('confirm')
  }

  // Handle install
  const handleInstall = async () => {
    setStep('pending')
    setError(null)

    try {
      let hash: Hash | undefined
      if (selectedModule) {
        hash = await installModule({
          account: account.address,
          module: selectedModule,
          config: configValues,
          initData: customInitData ?? undefined,
          gasPayment,
        })
      } else if (customAddress && customType !== null) {
        hash = await installCustomModule({
          account: account.address,
          moduleAddress: customAddress as Address,
          moduleType: String(customType),
          initData: customAddrInitData !== '0x' ? customAddrInitData : undefined,
          name: customName || undefined,
          gasPayment,
        })
      } else {
        setStep('confirm')
        return
      }
      // Transition to confirming — poll for on-chain receipt
      setUserOpHash(hash)
      setStep('confirming')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('installationFailed'))
      setStep('confirm')
    }
  }

  const hasConfig =
    isWebAuthnValidator ||
    isSessionKeyExecutor ||
    isSpendingLimitHook ||
    isMultiSigValidator ||
    isSwapExecutor ||
    isLendingExecutor ||
    isStakingExecutor ||
    isRecurringPaymentExecutor ||
    (selectedModule?.configSchema.fields.length ?? 0) > 0

  return (
    <div className="install-module-wizard">
      {/* Header */}
      <div
        className="wizard-header flex items-center justify-between p-4"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgb(var(--border))' }}
      >
        <button type="button" style={{ color: 'rgb(var(--muted-foreground))' }} onClick={onCancel}>
          ← {tc('back')}
        </button>
        <h2 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {t('installModule')}
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
            onCustomInstall={() => setStep('custom-address')}
          />
        )}

        {/* Step: Custom Address */}
        {step === 'custom-address' && (
          <CustomModuleInput
            initialType={selectedType}
            onSubmit={(address, moduleType, initData, name) => {
              setSelectedModule(null)
              setCustomAddress(address)
              setCustomType(moduleType)
              setCustomAddrInitData(initData)
              setCustomName(name)
              setConfigValues({
                ...(name ? { name } : {}),
                address,
                type: getModuleTypeName(moduleType),
                ...(initData !== '0x' ? { initData } : {}),
              })
              setStep('confirm')
            }}
            onBack={() => setStep('select-module')}
          />
        )}

        {/* Step: Configure */}
        {step === 'configure' &&
          selectedModule &&
          (isWebAuthnValidator ? (
            <WebAuthnConfig
              accountAddress={account.address}
              onSubmit={handleWebAuthnComplete}
              onBack={() => setStep('select-module')}
            />
          ) : isSessionKeyExecutor ? (
            <SessionKeyConfigUI
              accountAddress={account.address}
              onSubmit={handleSessionKeyComplete}
              onBack={() => setStep('select-module')}
            />
          ) : isSpendingLimitHook ? (
            <SpendingLimitConfigUI
              accountAddress={account.address}
              onSubmit={handleSpendingLimitComplete}
              onBack={() => setStep('select-module')}
            />
          ) : isMultiSigValidator ? (
            <MultiSigConfigUI
              accountAddress={account.address}
              onSubmit={handleMultiSigComplete}
              onBack={() => setStep('select-module')}
            />
          ) : isSwapExecutor ? (
            <SwapExecutorConfigUI
              accountAddress={account.address}
              onSubmit={handleDefiExecutorComplete}
              onBack={() => setStep('select-module')}
            />
          ) : isLendingExecutor ? (
            <LendingExecutorConfigUI
              accountAddress={account.address}
              onSubmit={handleDefiExecutorComplete}
              onBack={() => setStep('select-module')}
            />
          ) : isStakingExecutor ? (
            <StakingExecutorConfigUI
              accountAddress={account.address}
              onSubmit={handleDefiExecutorComplete}
              onBack={() => setStep('select-module')}
            />
          ) : isRecurringPaymentExecutor ? (
            <RecurringPaymentConfigUI
              accountAddress={account.address}
              onSubmit={handleDefiExecutorComplete}
              onBack={() => setStep('select-module')}
            />
          ) : (
            <ModuleConfigForm
              module={selectedModule}
              initialValues={configValues}
              onSubmit={handleConfigComplete}
              onBack={() => setStep('select-module')}
            />
          ))}

        {/* Step: Confirm */}
        {step === 'confirm' && selectedModule && (
          <InstallConfirmation
            module={selectedModule}
            config={configValues}
            error={error}
            gasPayment={gasPayment}
            onGasPaymentChange={setGasPayment}
            accountAddress={account.address}
            onConfirm={handleInstall}
            onBack={() => setStep(hasConfig ? 'configure' : 'select-module')}
          />
        )}

        {step === 'confirm' && !selectedModule && customAddress && (
          <CustomInstallConfirmation
            address={customAddress}
            moduleType={customType}
            name={customName}
            initData={customAddrInitData}
            config={configValues}
            error={error}
            gasPayment={gasPayment}
            onGasPaymentChange={setGasPayment}
            accountAddress={account.address}
            onConfirm={handleInstall}
            onBack={() => setStep('custom-address')}
          />
        )}

        {/* Step: Pending (submitting to bundler) */}
        {step === 'pending' && (
          <div className="pending-state text-center py-12">
            <div
              className="w-12 h-12 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
            />
            <p style={{ color: 'rgb(var(--foreground))' }}>{t('installingModule')}</p>
            <p className="text-sm mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('confirmTransaction')}
            </p>
          </div>
        )}

        {/* Step: Confirming (waiting for on-chain confirmation) */}
        {step === 'confirming' && (
          <div className="confirming-state text-center py-12">
            <div
              className="w-12 h-12 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
            />
            <p style={{ color: 'rgb(var(--foreground))' }}>
              {t('waitingConfirmation', 'Waiting for on-chain confirmation...')}
            </p>
            {userOpHash && (
              <p
                className="text-xs mt-3 font-mono break-all px-4"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {userOpHash}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {t('doNotClose', 'Please do not close this window')}
            </p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="success-state text-center py-12">
            <div
              className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="rgb(var(--primary))"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {t('moduleInstalled', 'Module installed successfully')}
            </p>
            <button
              type="button"
              className="mt-6 px-6 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'rgb(var(--primary))', color: 'white' }}
              onClick={onComplete}
            >
              {t('done', 'Done')}
            </button>
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
  const isCustomPath = currentStep === 'custom-address'
  const steps = isCustomPath
    ? ['select-type', 'select-module', 'custom-address', 'confirm']
    : ['select-type', 'select-module', ...(hasConfig ? ['configure'] : []), 'confirm']
  const currentIndex = steps.indexOf(currentStep)

  return (
    <div className="wizard-progress flex items-center justify-center gap-2 py-4">
      {steps.map((step, index) => (
        <Fragment key={step}>
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: index <= currentIndex ? 'rgb(var(--primary))' : 'rgb(var(--border))',
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
  const { t } = useTranslation('modules')

  const types = [
    {
      type: MODULE_TYPE.VALIDATOR,
      icon: '🔐',
      name: t('validators').slice(0, -1),
      description: t('validatorDesc'),
    },
    {
      type: MODULE_TYPE.EXECUTOR,
      icon: '⚡',
      name: t('executors').slice(0, -1),
      description: t('executorDesc'),
    },
    {
      type: MODULE_TYPE.HOOK,
      icon: '🪝',
      name: t('hooks').slice(0, -1),
      description: t('hookDesc'),
    },
    {
      type: MODULE_TYPE.FALLBACK,
      icon: '🔄',
      name: t('fallbacks').slice(0, -1),
      description: t('fallbackDesc'),
    },
  ]

  return (
    <div className="type-selector">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        {t('whatTypeOfModule')}
      </h3>
      <div className="space-y-3">
        {types.map((type) => (
          <button
            type="button"
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
  onCustomInstall: () => void
}

function ModuleSelector({ modules, type, onSelect, onCustomInstall }: ModuleSelectorProps) {
  const { t } = useTranslation('modules')

  return (
    <div className="module-selector">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        {t('selectType', { type: getModuleTypeName(type) })}
      </h3>

      {modules.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('noTypeAvailable', { type: getModuleTypeName(type).toLowerCase() })}
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <button
              type="button"
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
                        {t('verifiedCheck')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
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

      {/* Custom module install divider + button */}
      <div className="mt-6">
        <div
          className="flex items-center gap-3 mb-4"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgb(var(--border))' }} />
          <span className="text-sm">{t('orInstallCustom')}</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgb(var(--border))' }} />
        </div>
        <button
          type="button"
          className="w-full p-4 rounded-lg text-left transition-all"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--border))',
            borderStyle: 'dashed',
          }}
          onClick={onCustomInstall}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {t('installByAddress')}
              </h4>
              <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('installByAddressDesc')}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

interface InstallConfirmationProps {
  module: ModuleRegistryEntry
  config: Record<string, unknown>
  error: string | null
  gasPayment: GasPaymentConfig
  onGasPaymentChange: (config: GasPaymentConfig) => void
  accountAddress: Address
  onConfirm: () => void
  onBack: () => void
}

function InstallConfirmation({
  module,
  config,
  error,
  gasPayment,
  onGasPaymentChange,
  accountAddress,
  onConfirm,
  onBack,
}: InstallConfirmationProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')

  return (
    <div className="install-confirmation">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        {t('confirmInstallation')}
      </h3>

      {/* Module Info */}
      <div
        className="module-info p-4 rounded-lg mb-4"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {module.metadata.name}
        </h4>
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {module.metadata.description}
        </p>
      </div>

      {/* Configuration Summary */}
      {Object.keys(config).length > 0 && (
        <div
          className="config-summary p-4 rounded-lg mb-4"
          style={{ backgroundColor: 'rgb(var(--secondary))' }}
        >
          <h5 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
            {t('configuration')}
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

      {/* Gas Payment */}
      <div className="mb-4">
        <GasPaymentSelector
          gasPayment={gasPayment}
          onGasPaymentChange={onGasPaymentChange}
          gasEstimate={null}
          accountAddress={accountAddress}
        />
      </div>

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
          onClick={onConfirm}
        >
          {t('installModule')}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Custom Module Components
// ============================================================================

interface CustomModuleInputProps {
  initialType: ModuleType | null
  onSubmit: (address: string, moduleType: ModuleType, initData: Hex, name: string) => void
  onBack: () => void
}

function CustomModuleInput({ initialType, onSubmit, onBack }: CustomModuleInputProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')

  const [address, setAddress] = useState('')
  const [moduleType, setModuleType] = useState<ModuleType | null>(initialType)
  const [initData, setInitData] = useState('')
  const [name, setName] = useState('')
  const [addressError, setAddressError] = useState<string | null>(null)
  const [typeError, setTypeError] = useState<string | null>(null)

  const handleContinue = () => {
    let hasError = false

    if (!isAddress(address)) {
      setAddressError(t('invalidModuleAddress'))
      hasError = true
    } else {
      setAddressError(null)
    }

    if (moduleType === null) {
      setTypeError(t('moduleTypeRequired'))
      hasError = true
    } else {
      setTypeError(null)
    }

    if (hasError) return

    const hexInitData: Hex = initData?.startsWith('0x') ? (initData as Hex) : '0x'
    onSubmit(address, moduleType as ModuleType, hexInitData, name)
  }

  const moduleTypes = [
    { type: MODULE_TYPE.VALIDATOR, label: 'Validator', icon: '🔐' },
    { type: MODULE_TYPE.EXECUTOR, label: 'Executor', icon: '⚡' },
    { type: MODULE_TYPE.HOOK, label: 'Hook', icon: '🪝' },
    { type: MODULE_TYPE.FALLBACK, label: 'Fallback', icon: '🔄' },
  ]

  return (
    <div className="custom-module-input">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        {t('installByAddress')}
      </h3>

      {/* Warning */}
      <div
        className="p-3 rounded-lg mb-4 text-sm"
        style={{
          backgroundColor: 'rgb(var(--warning-background, 255 243 205))',
          color: 'rgb(var(--warning-foreground, 133 100 4))',
          borderWidth: 1,
          borderColor: 'rgb(var(--warning-border, 255 224 130))',
        }}
      >
        {t('customModuleWarning')}
      </div>

      {/* Contract Address */}
      <div className="mb-4">
        <label
          htmlFor="custom-module-address"
          className="block text-sm font-medium mb-1"
          style={{ color: 'rgb(var(--foreground))' }}
        >
          {t('customModuleAddress')}
        </label>
        <input
          id="custom-module-address"
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            setAddressError(null)
          }}
          placeholder="0x..."
          className="w-full px-3 py-2 rounded-lg text-sm font-mono"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: addressError ? 'rgb(var(--destructive))' : 'rgb(var(--border))',
            color: 'rgb(var(--foreground))',
          }}
        />
        {addressError && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
            {addressError}
          </p>
        )}
      </div>

      {/* Module Type */}
      <div className="mb-4">
        <label
          htmlFor="module-type-selector"
          className="block text-sm font-medium mb-2"
          style={{ color: 'rgb(var(--foreground))' }}
        >
          {t('selectModuleType')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {moduleTypes.map((mt) => (
            <button
              type="button"
              key={String(mt.type)}
              className="p-3 rounded-lg text-left transition-all"
              style={{
                backgroundColor:
                  moduleType === mt.type ? 'rgb(var(--primary) / 0.1)' : 'rgb(var(--card))',
                borderWidth: 2,
                borderColor: moduleType === mt.type ? 'rgb(var(--primary))' : 'rgb(var(--border))',
              }}
              onClick={() => {
                setModuleType(mt.type)
                setTypeError(null)
              }}
            >
              <span className="text-lg">{mt.icon}</span>
              <span
                className="ml-2 text-sm font-medium"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {mt.label}
              </span>
            </button>
          ))}
        </div>
        {typeError && (
          <p className="text-xs mt-1" style={{ color: 'rgb(var(--destructive))' }}>
            {typeError}
          </p>
        )}
      </div>

      {/* Init Data (Optional) */}
      <div className="mb-4">
        <label
          htmlFor="custom-module-initdata"
          className="block text-sm font-medium mb-1"
          style={{ color: 'rgb(var(--foreground))' }}
        >
          {t('initDataOptional')}
        </label>
        <textarea
          id="custom-module-initdata"
          value={initData}
          onChange={(e) => setInitData(e.target.value)}
          placeholder="0x..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm font-mono resize-none"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--border))',
            color: 'rgb(var(--foreground))',
          }}
        />
        <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('initDataHint')}
        </p>
      </div>

      {/* Module Name (Optional) */}
      <div className="mb-6">
        <label
          htmlFor="custom-module-name"
          className="block text-sm font-medium mb-1"
          style={{ color: 'rgb(var(--foreground))' }}
        >
          {t('moduleNameOptional')}
        </label>
        <input
          id="custom-module-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('moduleNameHint')}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgb(var(--card))',
            borderWidth: 1,
            borderColor: 'rgb(var(--border))',
            color: 'rgb(var(--foreground))',
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
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
          onClick={handleContinue}
        >
          {t('continue')}
        </button>
      </div>
    </div>
  )
}

interface CustomInstallConfirmationProps {
  address: string
  moduleType: ModuleType | null
  name: string
  initData: Hex
  config: Record<string, unknown>
  error: string | null
  gasPayment: GasPaymentConfig
  onGasPaymentChange: (config: GasPaymentConfig) => void
  accountAddress: Address
  onConfirm: () => void
  onBack: () => void
}

function CustomInstallConfirmation({
  address,
  moduleType,
  name,
  initData,
  error,
  gasPayment,
  onGasPaymentChange,
  accountAddress,
  onConfirm,
  onBack,
}: CustomInstallConfirmationProps) {
  const { t } = useTranslation('modules')
  const { t: tc } = useTranslation('common')

  const truncatedAddress = `${address.slice(0, 10)}...${address.slice(-8)}`

  return (
    <div className="install-confirmation">
      <h3 className="text-lg font-medium mb-4" style={{ color: 'rgb(var(--foreground))' }}>
        {t('confirmInstallation')}
      </h3>

      {/* Warning */}
      <div
        className="p-3 rounded-lg mb-4 text-sm"
        style={{
          backgroundColor: 'rgb(var(--warning-background, 255 243 205))',
          color: 'rgb(var(--warning-foreground, 133 100 4))',
          borderWidth: 1,
          borderColor: 'rgb(var(--warning-border, 255 224 130))',
        }}
      >
        {t('customModuleWarning')}
      </div>

      {/* Module Info */}
      <div
        className="module-info p-4 rounded-lg mb-4"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <h4 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {name || t('installByAddress')}
        </h4>
        <dl className="text-sm space-y-2 mt-2">
          <div className="flex justify-between">
            <dt style={{ color: 'rgb(var(--muted-foreground))' }}>{t('contractAddress')}:</dt>
            <dd className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
              {truncatedAddress}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: 'rgb(var(--muted-foreground))' }}>{t('selectModuleType')}:</dt>
            <dd style={{ color: 'rgb(var(--foreground))' }}>
              {moduleType !== null ? getModuleTypeName(moduleType) : '-'}
            </dd>
          </div>
          {initData !== '0x' && (
            <div className="flex justify-between">
              <dt style={{ color: 'rgb(var(--muted-foreground))' }}>{t('initDataOptional')}:</dt>
              <dd className="font-mono" style={{ color: 'rgb(var(--foreground))' }}>
                {String(initData).slice(0, 20)}
                {String(initData).length > 20 && '...'}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Gas Payment */}
      <div className="mb-4">
        <GasPaymentSelector
          gasPayment={gasPayment}
          onGasPaymentChange={onGasPaymentChange}
          gasEstimate={null}
          accountAddress={accountAddress}
        />
      </div>

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
          onClick={onConfirm}
        >
          {t('installModule')}
        </button>
      </div>
    </div>
  )
}
