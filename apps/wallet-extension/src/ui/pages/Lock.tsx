import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Input } from '../components/common'

interface LockProps {
  onUnlock: (password: string) => Promise<void>
  error?: string
}

export function Lock({ onUnlock, error }: LockProps) {
  const { t } = useTranslation('lock')
  const { t: tc } = useTranslation('common')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return

    setIsLoading(true)
    setLocalError('')

    try {
      await onUnlock(password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : tc('failedToUnlock'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      {/* Logo */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))',
        }}
      >
        <span className="text-2xl font-bold text-white">S</span>
      </div>

      <h1 className="text-xl font-bold mb-1" style={{ color: 'rgb(var(--foreground))' }}>
        {t('welcomeBack')}
      </h1>
      <p className="text-sm mb-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {t('enterPasswordToUnlock')}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="mb-4">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('enterPassword')}
            error={localError || error}
            autoFocus
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {showPassword ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
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
                )}
              </button>
            }
          />
        </div>

        <Button type="submit" fullWidth isLoading={isLoading} disabled={!password}>
          {t('unlock')}
        </Button>
      </form>

      <button type="button" className="mt-6 text-sm" style={{ color: 'rgb(var(--primary))' }}>
        {t('forgotPassword')}
      </button>

      <Card variant="filled" padding="sm" className="mt-8 max-w-sm">
        <p className="text-xs text-center" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('forgotPasswordHint')}
        </p>
      </Card>
    </div>
  )
}
