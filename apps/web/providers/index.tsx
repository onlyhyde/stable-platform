'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/common'
import { StableNetProvider } from './StableNetProvider'
import { ThemeProvider } from './ThemeProvider'

// Dynamically import WalletProvider to prevent SSR issues with wagmi
const DynamicWalletProvider = dynamic(
  () => import('./WalletProvider').then((mod) => mod.WalletProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-dark-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-dark-200 dark:border-dark-700" />
            <div className="absolute inset-0 rounded-full border-4 border-t-primary-500 animate-spin" />
          </div>
          <p className="text-sm font-medium text-dark-500 dark:text-dark-400">Loading...</p>
        </div>
      </div>
    ),
  }
)

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <DynamicWalletProvider>
        <StableNetProvider>
          <ToastProvider>{children}</ToastProvider>
        </StableNetProvider>
      </DynamicWalletProvider>
    </ThemeProvider>
  )
}

export { StableNetProvider, useStableNetContext } from './StableNetProvider'
export { ThemeProvider, ThemeSelector, ThemeToggle, useTheme } from './ThemeProvider'
