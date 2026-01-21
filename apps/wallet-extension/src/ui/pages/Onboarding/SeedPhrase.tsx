import { useState } from 'react'
import { Button, Card, Toggle } from '../../components/common'

interface SeedPhraseProps {
  mnemonic: string
  onConfirm: () => void
  onBack: () => void
}

export function SeedPhrase({ mnemonic, onConfirm, onBack }: SeedPhraseProps) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [understood, setUnderstood] = useState(false)

  const words = mnemonic.split(' ')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API failed
    }
  }

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
        <h1 className="text-xl font-bold text-gray-900">Secret Recovery Phrase</h1>
        <p className="text-gray-500 mt-1">
          Write down these {words.length} words in order and keep them safe
        </p>
      </div>

      {/* Warning */}
      <Card variant="filled" padding="md" className="mb-4 bg-red-50 border-red-100">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-red-800">NEVER share your recovery phrase</p>
            <p className="text-red-700">
              Anyone with these words can access your wallet and steal your funds.
            </p>
          </div>
        </div>
      </Card>

      {/* Seed phrase grid */}
      <div className="flex-1">
        <div className="relative">
          <div
            className={`grid grid-cols-3 gap-2 p-4 bg-gray-50 rounded-xl ${
              !revealed ? 'filter blur-sm select-none' : ''
            }`}
          >
            {words.map((word, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200"
              >
                <span className="text-xs text-gray-400 w-4">{index + 1}.</span>
                <span className="text-sm font-medium text-gray-900">{word}</span>
              </div>
            ))}
          </div>

          {/* Reveal overlay */}
          {!revealed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                onClick={() => setRevealed(true)}
                variant="primary"
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              >
                Reveal Seed Phrase
              </Button>
            </div>
          )}
        </div>

        {/* Copy button */}
        {revealed && (
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 text-sm text-indigo-600 hover:text-indigo-700"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to clipboard
              </>
            )}
          </button>
        )}
      </div>

      {/* Confirmation */}
      <div className="mt-4 space-y-4">
        <Toggle
          enabled={understood}
          onChange={setUnderstood}
          label="I have written down my recovery phrase and stored it safely"
          size="sm"
        />

        <Button
          onClick={onConfirm}
          fullWidth
          disabled={!revealed || !understood}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
