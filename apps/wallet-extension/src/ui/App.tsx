import { useEffect } from 'react'
import { useWalletStore } from './hooks/useWalletStore'
import { Header } from './components/Header'
import { Navigation } from './components/Navigation'
import { Home, Send, Receive, Activity, Settings, Lock, Bank, BuyPage } from './pages'
import { Onboarding } from './pages/Onboarding'
import { Spinner } from './components/common'
import './styles/globals.css'

export function App() {
  const {
    currentPage,
    isLoading,
    isInitialized,
    isUnlocked,
    error,
    setError,
    syncWithBackground,
    unlockWallet,
  } = useWalletStore()

  useEffect(() => {
    // Sync with background on mount
    syncWithBackground()
  }, [syncWithBackground])

  useEffect(() => {
    // Listen for state updates from background
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'STATE_UPDATE') {
        syncWithBackground()
      }
    }

    chrome.runtime?.onMessage?.addListener(handleMessage)

    return () => {
      chrome.runtime?.onMessage?.removeListener(handleMessage)
    }
  }, [syncWithBackground])

  // Show loading spinner while checking initialization
  if (isLoading && !isInitialized) {
    return (
      <div className="w-[360px] h-[600px] bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // Show onboarding if wallet is not initialized
  if (!isInitialized) {
    return (
      <div className="w-[360px] h-[600px] bg-gray-50">
        <Onboarding onComplete={() => syncWithBackground()} />
      </div>
    )
  }

  // Show lock screen if wallet is locked
  if (!isUnlocked) {
    return (
      <div className="w-[360px] h-[600px] bg-gray-50">
        <Lock
          onUnlock={async (password) => {
            const success = await unlockWallet(password)
            if (!success) {
              throw new Error('Invalid password')
            }
          }}
          error={error ?? undefined}
        />
      </div>
    )
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />
      case 'send':
        return <Send />
      case 'receive':
        return <Receive />
      case 'activity':
        return <Activity />
      case 'settings':
        return <Settings />
      case 'bank':
        return <Bank />
      case 'buy':
        return <BuyPage />
      default:
        return <Home />
    }
  }

  return (
    <div className="w-[360px] h-[600px] bg-gray-50 flex flex-col">
      <Header />

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16">{renderPage()}</main>

      <Navigation />
    </div>
  )
}
