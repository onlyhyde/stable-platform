'use client'

import type { ReactNode } from 'react'
import { WalletProvider } from './WalletProvider'
import { StableNetProvider } from './StableNetProvider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletProvider>
      <StableNetProvider>
        {children}
      </StableNetProvider>
    </WalletProvider>
  )
}

export { WalletProvider } from './WalletProvider'
export { StableNetProvider, useStableNetContext } from './StableNetProvider'
