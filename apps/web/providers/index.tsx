'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { StableNetProvider } from './StableNetProvider'
import { ToastProvider } from '@/components/common'

// Dynamically import WalletProvider to prevent SSR issues with wagmi
const DynamicWalletProvider = dynamic(
  () => import('./WalletProvider').then((mod) => mod.WalletProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600" />
      </div>
    ),
  }
)

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <DynamicWalletProvider>
      <StableNetProvider>
        <ToastProvider>{children}</ToastProvider>
      </StableNetProvider>
    </DynamicWalletProvider>
  )
}

export { StableNetProvider, useStableNetContext } from './StableNetProvider'
