import { useTranslation } from 'react-i18next'
import type { Address } from 'viem'
import { AddressDisplay, Button, Card } from '../../components/common'

interface CompleteProps {
  address: Address
  onFinish: () => void
}

export function Complete({ address, onFinish }: CompleteProps) {
  const { t } = useTranslation('onboarding')

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      {/* Success animation */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
      >
        <svg
          className="w-10 h-10"
          style={{ color: 'rgb(var(--success))' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
        {t('completeTitle')}
      </h1>
      <p className="text-center mb-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {t('completeSubtitle')}
      </p>

      {/* Account card */}
      <Card padding="lg" className="w-full mb-6">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
          >
            <span className="text-lg font-bold" style={{ color: 'rgb(var(--primary))' }}>
              {address.slice(2, 4).toUpperCase()}
            </span>
          </div>
          <p className="font-medium mb-2" style={{ color: 'rgb(var(--foreground))' }}>
            {t('defaultAccountName')}
          </p>
          <AddressDisplay address={address} truncate showCopy className="justify-center" />
        </div>
      </Card>

      {/* Tips */}
      <div className="w-full space-y-3 mb-8">
        <Card variant="filled" padding="sm">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <svg
                className="w-4 h-4"
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
              {t('keepRecoveryPhraseSafe')}
            </p>
          </div>
        </Card>

        <Card variant="filled" padding="sm">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgb(var(--success) / 0.1)' }}
            >
              <svg
                className="w-4 h-4"
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
              {t('supportsSmartAccount')}
            </p>
          </div>
        </Card>

        <Card variant="filled" padding="sm">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgb(var(--accent) / 0.1)' }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: 'rgb(var(--accent))' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'rgb(var(--foreground-secondary))' }}>
              {t('gasSponsoredByPaymasters')}
            </p>
          </div>
        </Card>
      </div>

      <Button onClick={onFinish} fullWidth size="lg">
        {t('startUsing')}
      </Button>
    </div>
  )
}
