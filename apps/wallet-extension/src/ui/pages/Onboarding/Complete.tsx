import { Button, Card } from '../../components/common'
import { AddressDisplay } from '../../components/common'
import type { Address } from 'viem'

interface CompleteProps {
  address: Address
  onFinish: () => void
}

export function Complete({ address, onFinish }: CompleteProps) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      {/* Success animation */}
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Wallet Created!
      </h1>
      <p className="text-gray-500 text-center mb-8">
        Your wallet is ready to use
      </p>

      {/* Account card */}
      <Card padding="lg" className="w-full mb-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-lg font-bold text-indigo-600">
              {address.slice(2, 4).toUpperCase()}
            </span>
          </div>
          <p className="font-medium text-gray-900 mb-2">Account 1</p>
          <AddressDisplay
            address={address}
            truncate
            showCopy
            className="justify-center"
          />
        </div>
      </Card>

      {/* Tips */}
      <div className="w-full space-y-3 mb-8">
        <Card variant="filled" padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">
              Keep your recovery phrase safe and never share it
            </p>
          </div>
        </Card>

        <Card variant="filled" padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">
              Your wallet supports smart account features
            </p>
          </div>
        </Card>

        <Card variant="filled" padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">
              Gas fees can be sponsored by paymasters
            </p>
          </div>
        </Card>
      </div>

      <Button onClick={onFinish} fullWidth size="lg">
        Start Using StableNet
      </Button>
    </div>
  )
}
