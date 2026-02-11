import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Enterprise',
  description: 'Enterprise payroll, expenses, and audit management on StableNet',
}

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
