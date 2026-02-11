import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Input, Toggle } from '../../components/common'

interface CreatePasswordProps {
  onSubmit: (password: string) => void
  onBack: () => void
  isLoading?: boolean
}

export function CreatePassword({ onSubmit, onBack, isLoading }: CreatePasswordProps) {
  const { t } = useTranslation('onboarding')
  const { t: tc } = useTranslation('common')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState('')

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return t('passwordMinLength')
    }
    if (!/[A-Z]/.test(pwd)) {
      return t('passwordUppercase')
    }
    if (!/[a-z]/.test(pwd)) {
      return t('passwordLowercase')
    }
    if (!/[0-9]/.test(pwd)) {
      return t('passwordNumber')
    }
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'))
      return
    }

    if (!agreedToTerms) {
      setError(t('agreeToTerms'))
      return
    }

    onSubmit(password)
  }

  const passwordStrength = (() => {
    if (!password) return 0
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  })()

  // Strength colors are now handled inline with CSS variables
  const strengthLabels = [
    t('strengthVeryWeak'),
    t('strengthWeak'),
    t('strengthFair'),
    t('strengthStrong'),
    t('strengthVeryStrong'),
  ]

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
          {t('createPasswordTitle')}
        </h1>
        <p className="mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {t('createPasswordSubtitle')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="space-y-4 flex-1">
          <div>
            <Input
              label={t('password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('enterPassword')}
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

            {/* Password strength indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 h-1">
                  {(['very-weak', 'weak', 'fair', 'strong', 'very-strong'] as const).map(
                    (level, i) => (
                      <div
                        key={level}
                        className="flex-1 rounded-full"
                        style={{
                          backgroundColor:
                            i < passwordStrength
                              ? [
                                  'rgb(var(--destructive))',
                                  'rgb(239 68 68)',
                                  'rgb(var(--warning))',
                                  'rgb(132 204 22)',
                                  'rgb(var(--success))',
                                ][passwordStrength - 1]
                              : 'rgb(var(--border))',
                        }}
                      />
                    )
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {strengthLabels[passwordStrength - 1] ?? 'Enter password'}
                </p>
              </div>
            )}
          </div>

          <Input
            label={t('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('confirmPasswordPlaceholder')}
            error={
              confirmPassword && password !== confirmPassword ? t('passwordsDoNotMatch') : undefined
            }
          />

          <Card variant="filled" padding="md">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: 'rgb(var(--warning))' }}
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
                <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                  {t('rememberPassword')}
                </p>
                <p style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {t('cannotRecoverPassword')}
                </p>
              </div>
            </div>
          </Card>

          <Toggle
            enabled={agreedToTerms}
            onChange={setAgreedToTerms}
            label={t('agreeCannotRecover')}
            size="sm"
          />

          {error && (
            <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          fullWidth
          disabled={!password || !confirmPassword || !agreedToTerms}
          isLoading={isLoading}
        >
          {t('createPasswordBtn')}
        </Button>
      </form>
    </div>
  )
}
