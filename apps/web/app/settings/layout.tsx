import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings | StableNet',
  description: 'Manage your account, network, and security settings',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
