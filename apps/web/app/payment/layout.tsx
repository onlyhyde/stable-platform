import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment',
  description: 'Send and receive payments on StableNet',
}

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
