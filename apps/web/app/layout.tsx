import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Footer, Header, Sidebar } from '@/components/layout'
import { Providers } from '@/providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
}

export const metadata: Metadata = {
  title: {
    default: 'StableNet',
    template: '%s | StableNet',
  },
  description:
    'StableNet Smart Account Platform - Send, receive, swap, and manage your crypto with smart accounts.',
  keywords: [
    'crypto',
    'smart account',
    'ERC-4337',
    'account abstraction',
    'defi',
    'stealth',
    'web3',
    'blockchain',
  ],
  authors: [{ name: 'StableNet Team' }],
  creator: 'StableNet',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'StableNet',
    title: 'StableNet - Smart Account Platform',
    description: 'Send, receive, swap, and manage your crypto with smart accounts.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StableNet - Smart Account Platform',
    description: 'Send, receive, swap, and manage your crypto with smart accounts.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-surface-base antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 ml-64 min-h-[calc(100vh-4rem)]">
                <div className="p-6 lg:p-8">{children}</div>
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
