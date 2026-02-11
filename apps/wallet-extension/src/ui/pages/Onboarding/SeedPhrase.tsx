import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Toggle } from '../../components/common'

interface SeedPhraseProps {
  mnemonic: string
  onConfirm: () => void
  onBack: () => void
}

export function SeedPhrase({ mnemonic, onConfirm, onBack }: SeedPhraseProps) {
  const { t } = useTranslation('onboarding')
  const { t: tc } = useTranslation('common')
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
    <div
      className="min-h-full flex flex-col p-6"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center mb-4 transition-colors"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          <svg
            className="w-5 h-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {tc('back')}
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          {t('seedPhraseTitle')}
        </h1>
        <p className="mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('seedPhraseSubtitle', { count: words.length })}
        </p>
      </div>

      {/* Warning */}
      <Card
        variant="filled"
        padding="md"
        className="mb-4"
        style={{
          backgroundColor: 'rgb(var(--destructive) / 0.1)',
          border: '1px solid rgb(var(--destructive) / 0.2)',
        }}
      >
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            style={{ color: 'rgb(var(--destructive))' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-sm">
            <p className="font-medium" style={{ color: 'rgb(var(--destructive))' }}>
              {t('neverShareSeed')}
            </p>
            <p style={{ color: 'rgb(var(--destructive) / 0.8)' }}>{t('neverShareSeedDesc')}</p>
          </div>
        </div>
      </Card>

      {/* Seed phrase grid */}
      <div className="flex-1">
        <div className="relative">
          <div
            className={`grid grid-cols-3 gap-2 p-4 rounded-xl ${
              !revealed ? 'filter blur-sm select-none' : ''
            }`}
            style={{ backgroundColor: 'rgb(var(--surface))' }}
          >
            {words.map((word, index) => (
              <div
                key={`${index}-${word}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  backgroundColor: 'rgb(var(--background-raised))',
                  border: '1px solid rgb(var(--border))',
                }}
              >
                <span className="text-xs w-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {index + 1}.
                </span>
                <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {word}
                </span>
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
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                }
              >
                {t('revealSeedPhrase')}
              </Button>
            </div>
          )}
        </div>

        {/* Copy button */}
        {revealed && (
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 text-sm transition-colors"
            style={{ color: copied ? 'rgb(var(--success))' : 'rgb(var(--primary))' }}
          >
            {copied ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {tc('copied')}
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {t('copyToClipboard')}
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
          label={t('writtenDownConfirm')}
          size="sm"
        />

        <Button onClick={onConfirm} fullWidth disabled={!revealed || !understood}>
          {t('continue')}
        </Button>
      </div>
    </div>
  )
}
