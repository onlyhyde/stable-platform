import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stealth',
  description: 'Private transactions using stealth addresses on StableNet',
}

export default function StealthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
