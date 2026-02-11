import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DeFi',
  description: 'Swap tokens and provide liquidity on StableNet',
}

export default function DeFiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
