import { Button, Card } from '../../components/common'

interface WelcomeProps {
  onCreateNew: () => void
  onImport: () => void
}

export function Welcome({ onCreateNew, onImport }: WelcomeProps) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
        <span className="text-3xl font-bold text-white">S</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome to StableNet
      </h1>
      <p className="text-gray-500 text-center mb-8">
        Your gateway to the decentralized future
      </p>

      <div className="w-full space-y-4">
        <Card padding="lg" className="hover:border-indigo-200 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <svg
                className="w-6 h-6 text-indigo-600"
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
              <h3 className="font-semibold text-gray-900 mb-1">
                Create a new wallet
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Generate a new seed phrase and set up your wallet
              </p>
              <Button onClick={onCreateNew} fullWidth>
                Create New Wallet
              </Button>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="hover:border-indigo-200 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <svg
                className="w-6 h-6 text-green-600"
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
              <h3 className="font-semibold text-gray-900 mb-1">
                Import existing wallet
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Restore your wallet using a seed phrase
              </p>
              <Button onClick={onImport} variant="secondary" fullWidth>
                Import Wallet
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  )
}
