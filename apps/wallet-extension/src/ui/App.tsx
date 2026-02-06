import { useEffect } from 'react'
import { Header } from './components/Header'
import { Navigation } from './components/Navigation'
import { Spinner } from './components/common'
import { useWalletStore } from './hooks/useWalletStore'
import { Activity, Bank, BuyPage, Home, Lock, ModulesPage, Receive, Send, Settings } from './pages'
import { Onboarding } from './pages/Onboarding'
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
      <div
        className="w-[360px] h-[600px] flex items-center justify-center"
        style={{ backgroundColor: 'rgb(var(--background))' }}
      >
        <Spinner size="lg" />
      </div>
    )
  }

  // Show onboarding if wallet is not initialized
  if (!isInitialized) {
    return (
      <div className="w-[360px] h-[600px]" style={{ backgroundColor: 'rgb(var(--background))' }}>
        <Onboarding onComplete={() => syncWithBackground()} />
      </div>
    )
  }

  // Show lock screen if wallet is locked
  if (!isUnlocked) {
    return (
      <div className="w-[360px] h-[600px]" style={{ backgroundColor: 'rgb(var(--background))' }}>
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
      case 'modules':
        return <ModulesPage />
      default:
        return <Home />
    }
  }

  return (
    <div
      className="w-[360px] h-[600px] flex flex-col ambient-glow"
      style={{ backgroundColor: 'rgb(var(--background))' }}
    >
      <Header />

      {/* Error Banner */}
      {error && (
        <div
          className="px-4 py-2 flex items-center justify-between transition-all-fast"
          style={{
            backgroundColor: 'rgb(var(--destructive) / 0.1)',
            borderBottom: '1px solid rgb(var(--destructive) / 0.2)',
          }}
        >
          <p className="text-sm" style={{ color: 'rgb(var(--destructive))' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="transition-all-fast hover:opacity-80"
            style={{ color: 'rgb(var(--destructive))' }}
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgb(var(--background) / 0.8)' }}
        >
          <div
            className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
            style={{ borderColor: 'rgb(var(--primary))', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16 relative z-10">{renderPage()}</main>

      <Navigation />
    </div>
  )
}
