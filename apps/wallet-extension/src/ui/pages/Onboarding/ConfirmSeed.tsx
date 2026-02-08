import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '../../components/common'

interface ConfirmSeedProps {
  mnemonic: string
  onConfirm: () => void
  onBack: () => void
}

export function ConfirmSeed({ mnemonic, onConfirm, onBack }: ConfirmSeedProps) {
  const { t } = useTranslation('onboarding')
  const { t: tc } = useTranslation('common')
  const words = mnemonic.split(' ')

  // Select 3 random word positions to verify
  const verificationIndices = useMemo(() => {
    const indices: number[] = []
    while (indices.length < 3) {
      const index = Math.floor(Math.random() * words.length)
      if (!indices.includes(index)) {
        indices.push(index)
      }
    }
    return indices.sort((a, b) => a - b)
  }, [words.length])

  const [selectedWords, setSelectedWords] = useState<Record<number, string>>({})
  const [error, setError] = useState('')

  // Generate shuffled word options for each position
  const wordOptions = useMemo(() => {
    const options: Record<number, string[]> = {}
    for (const index of verificationIndices) {
      const correctWord = words[index]
      const otherWords = words.filter((_, i) => i !== index)
      const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, 3)
      options[index] = [...shuffled, correctWord ?? '']
        .filter((w): w is string => !!w)
        .sort(() => Math.random() - 0.5)
    }
    return options
  }, [verificationIndices, words])

  const handleSelectWord = (index: number, word: string) => {
    setError('')
    setSelectedWords((prev) => ({ ...prev, [index]: word }))
  }

  const handleConfirm = () => {
    // Verify all selected words
    for (const index of verificationIndices) {
      if (selectedWords[index] !== words[index]) {
        setError(t('incorrectWord'))
        return
      }
    }
    onConfirm()
  }

  const allSelected = verificationIndices.every((i) => selectedWords[i])

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
          {t('confirmSeedTitle')}
        </h1>
        <p className="mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('confirmSeedSubtitle')}
        </p>
      </div>

      {/* Verification sections */}
      <div className="flex-1 space-y-6">
        {verificationIndices.map((index) => (
          <div key={index}>
            <p
              className="text-sm font-medium mb-2"
              style={{ color: 'rgb(var(--foreground-secondary))' }}
            >
              {t('wordNumber', { index: index + 1 })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(wordOptions[index] ?? []).map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => handleSelectWord(index, word)}
                  className="px-4 py-3 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    backgroundColor:
                      selectedWords[index] === word
                        ? 'rgb(var(--primary) / 0.1)'
                        : 'rgb(var(--background-raised))',
                    borderColor:
                      selectedWords[index] === word ? 'rgb(var(--primary))' : 'rgb(var(--border))',
                    color:
                      selectedWords[index] === word
                        ? 'rgb(var(--primary))'
                        : 'rgb(var(--foreground-secondary))',
                  }}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        ))}

        {error && (
          <Card
            variant="filled"
            padding="sm"
            style={{
              backgroundColor: 'rgb(var(--destructive) / 0.1)',
              border: '1px solid rgb(var(--destructive) / 0.2)',
            }}
          >
            <div className="flex items-center gap-2" style={{ color: 'rgb(var(--destructive))' }}>
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
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          </Card>
        )}
      </div>

      {/* Confirm button */}
      <Button onClick={handleConfirm} fullWidth disabled={!allSelected} className="mt-6">
        {tc('confirm')}
      </Button>
    </div>
  )
}
