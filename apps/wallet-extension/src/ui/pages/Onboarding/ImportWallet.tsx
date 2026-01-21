import { useState } from 'react'
import { Button, TextArea, Card } from '../../components/common'

interface ImportWalletProps {
  onImport: (mnemonic: string) => void
  onBack: () => void
  isLoading?: boolean
  error?: string
}

export function ImportWallet({ onImport, onBack, isLoading, error }: ImportWalletProps) {
  const [mnemonic, setMnemonic] = useState('')
  const [validationError, setValidationError] = useState('')

  const validateMnemonic = (phrase: string): boolean => {
    const words = phrase.trim().split(/\s+/)
    // Valid mnemonics are 12 or 24 words
    return words.length === 12 || words.length === 24
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

    const cleanedMnemonic = mnemonic.trim().toLowerCase()

    if (!validateMnemonic(cleanedMnemonic)) {
      setValidationError('Please enter a valid 12 or 24 word seed phrase')
      return
    }

    onImport(cleanedMnemonic)
  }

  const wordCount = mnemonic.trim() ? mnemonic.trim().split(/\s+/).length : 0

  return (
    <div className="min-h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">Import Wallet</h1>
        <p className="text-gray-500 mt-1">
          Enter your 12 or 24 word seed phrase
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 space-y-4">
          <Card variant="filled" padding="md" className="bg-amber-50 border-amber-100">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-amber-800">Only import on trusted devices</p>
                <p className="text-amber-700">
                  Never enter your seed phrase on websites or share it with anyone.
                </p>
              </div>
            </div>
          </Card>

          <div>
            <TextArea
              label="Secret Recovery Phrase"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="Enter your seed phrase with spaces between words"
              rows={4}
              error={validationError || error}
              className="font-mono"
            />
            <p className="mt-2 text-sm text-gray-500">
              {wordCount} / 12 or 24 words
            </p>
          </div>

          {/* Word chips preview */}
          {wordCount > 0 && (
            <div className="flex flex-wrap gap-1">
              {mnemonic.trim().split(/\s+/).map((word, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                >
                  <span className="text-gray-400 mr-1">{index + 1}.</span>
                  {word}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <Button
            type="submit"
            fullWidth
            disabled={wordCount < 12}
            isLoading={isLoading}
          >
            Import Wallet
          </Button>

          <p className="text-xs text-center text-gray-400">
            Importing will create a new wallet with your seed phrase
          </p>
        </div>
      </form>
    </div>
  )
}
