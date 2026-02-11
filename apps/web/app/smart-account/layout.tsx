import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Smart Account',
  description:
    'Manage your EIP-7702 Smart Account - Upgrade and downgrade between EOA and Smart Account',
}

export default function SmartAccountLayout({ children }: { children: React.ReactNode }) {
  return children
}
