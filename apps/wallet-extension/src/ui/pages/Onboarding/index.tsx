import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { useWalletStore } from '../../hooks/useWalletStore'
import { Complete } from './Complete'
import { ConfirmSeed } from './ConfirmSeed'
import { CreatePassword } from './CreatePassword'
import { ImportWallet } from './ImportWallet'
import { SeedPhrase } from './SeedPhrase'
import { Welcome } from './Welcome'

export type OnboardingStep =
  | 'welcome'
  | 'createPassword'
  | 'seedPhrase'
  | 'confirmSeed'
  | 'importWallet'
  | 'importPassword'
  | 'complete'

interface OnboardingProps {
  onComplete: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { createWallet, restoreWallet } = useWalletStore()

  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [_password, setPassword] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [createdAddress, setCreatedAddress] = useState<Address | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Flow: Create New Wallet
  // welcome -> createPassword -> seedPhrase -> confirmSeed -> complete

  // Flow: Import Wallet
  // welcome -> importWallet -> importPassword -> complete

  const handleCreateNew = useCallback(() => {
    setStep('createPassword')
  }, [])

  const handleImport = useCallback(() => {
    setStep('importWallet')
  }, [])

  const handlePasswordCreate = useCallback(
    async (pwd: string) => {
      setPassword(pwd)
      setIsLoading(true)
      setError('')

      try {
        const result = await createWallet(pwd)
        setMnemonic(result.mnemonic)
        setCreatedAddress(result.address)
        setStep('seedPhrase')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create wallet')
      } finally {
        setIsLoading(false)
      }
    },
    [createWallet]
  )

  const handleSeedConfirm = useCallback(() => {
    setStep('confirmSeed')
  }, [])

  const handleConfirmComplete = useCallback(() => {
    setStep('complete')
  }, [])

  const handleImportMnemonic = useCallback((importedMnemonic: string) => {
    setMnemonic(importedMnemonic)
    setStep('importPassword')
  }, [])

  const handleImportPasswordCreate = useCallback(
    async (pwd: string) => {
      setPassword(pwd)
      setIsLoading(true)
      setError('')

      try {
        const address = await restoreWallet(pwd, mnemonic)
        setCreatedAddress(address)
        setStep('complete')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import wallet')
      } finally {
        setIsLoading(false)
      }
    },
    [mnemonic, restoreWallet]
  )

  const handleFinish = useCallback(() => {
    // Clear sensitive data
    setPassword('')
    setMnemonic('')
    onComplete()
  }, [onComplete])

  const handleBack = useCallback(() => {
    switch (step) {
      case 'createPassword':
      case 'importWallet':
        setStep('welcome')
        break
      case 'seedPhrase':
        setStep('createPassword')
        break
      case 'confirmSeed':
        setStep('seedPhrase')
        break
      case 'importPassword':
        setStep('importWallet')
        break
      default:
        setStep('welcome')
    }
  }, [step])

  return (
    <div className="h-full" style={{ backgroundColor: 'rgb(var(--background))' }}>
      {step === 'welcome' && <Welcome onCreateNew={handleCreateNew} onImport={handleImport} />}

      {step === 'createPassword' && (
        <CreatePassword onSubmit={handlePasswordCreate} onBack={handleBack} isLoading={isLoading} />
      )}

      {step === 'seedPhrase' && mnemonic && (
        <SeedPhrase mnemonic={mnemonic} onConfirm={handleSeedConfirm} onBack={handleBack} />
      )}

      {step === 'confirmSeed' && mnemonic && (
        <ConfirmSeed mnemonic={mnemonic} onConfirm={handleConfirmComplete} onBack={handleBack} />
      )}

      {step === 'importWallet' && (
        <ImportWallet onImport={handleImportMnemonic} onBack={handleBack} error={error} />
      )}

      {step === 'importPassword' && (
        <CreatePassword
          onSubmit={handleImportPasswordCreate}
          onBack={handleBack}
          isLoading={isLoading}
        />
      )}

      {step === 'complete' && createdAddress && (
        <Complete address={createdAddress} onFinish={handleFinish} />
      )}
    </div>
  )
}

export { Complete } from './Complete'
export { ConfirmSeed } from './ConfirmSeed'
export { CreatePassword } from './CreatePassword'
export { ImportWallet } from './ImportWallet'
export { SeedPhrase } from './SeedPhrase'
// Re-export individual components
export { Welcome } from './Welcome'
