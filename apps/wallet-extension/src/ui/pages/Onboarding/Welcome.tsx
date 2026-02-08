import { useTranslation } from 'react-i18next'
import { Button, Card } from '../../components/common'

interface WelcomeProps {
  onCreateNew: () => void
  onImport: () => void
}

export function Welcome({ onCreateNew, onImport }: WelcomeProps) {
  const { t } = useTranslation('onboarding')

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      {/* Logo */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))',
        }}
      >
        <span className="text-3xl font-bold text-white">S</span>
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
        {t('welcomeTitle')}
      </h1>
      <p className="text-center mb-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {t('welcomeSubtitle')}
      </p>

      <div className="w-full space-y-4">
        <Card padding="lg" className="transition-colors hover:border-opacity-50">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                className="w-6 h-6"
                style={{ color: 'rgb(var(--primary))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1" style={{ color: 'rgb(var(--foreground))' }}>
                {t('createNewWallet')}
              </h3>
              <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('createNewWalletDesc')}
              </p>
              <Button onClick={onCreateNew} fullWidth>
                {t('createNewWalletBtn')}
              </Button>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="transition-colors hover:border-opacity-50">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
            >
              <svg
                className="w-6 h-6"
                style={{ color: 'rgb(var(--success))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1" style={{ color: 'rgb(var(--foreground))' }}>
                {t('importWallet')}
              </h3>
              <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                {t('importWalletDesc')}
              </p>
              <Button onClick={onImport} variant="secondary" fullWidth>
                {t('importWalletBtn')}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <p className="text-xs mt-8 text-center" style={{ color: 'rgb(var(--foreground-tertiary))' }}>
        {t('termsAgreement')}
      </p>
    </div>
  )
}
