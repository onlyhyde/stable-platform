import type { Metadata } from 'next'
import { Providers } from '@/providers'
import { Header, Sidebar, Footer } from '@/components/layout'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'StableNet',
    template: '%s | StableNet',
  },
  description: 'StableNet Smart Account Platform - Send, receive, swap, and manage your crypto with smart accounts.',
  keywords: ['crypto', 'smart account', 'ERC-4337', 'account abstraction', 'defi', 'stealth'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 ml-64 p-6">
                {children}
              </main>
            </div>
            <div className="ml-64">
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
