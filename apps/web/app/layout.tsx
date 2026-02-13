import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import { ErrorBoundary } from '@/components/error'
import { Footer, Header, Sidebar } from '@/components/layout'
import { Providers } from '@/providers'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0E12' },
  ],
}

export const metadata: Metadata = {
  title: {
    default: 'StableNet',
    template: '%s | StableNet',
  },
  description:
    'StableNet - Institutional-grade KRW stablecoin infrastructure powered by account abstraction.',
  keywords: [
    'StableNet',
    'stablenet',
    'KRW Stablecoin',
    'smart account',
    'ERC-4337',
    'account abstraction',
    'defi',
    'blockchain',
    'web3',
    'institutional crypto',
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
    title: 'StableNet - Institutional-grade KRW Stablecoin Infrastructure',
    description:
      'Institutional-grade KRW stablecoin infrastructure powered by account abstraction.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StableNet - Institutional-grade KRW Stablecoin Infrastructure',
    description:
      'Institutional-grade KRW stablecoin infrastructure powered by account abstraction.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-surface-base antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 md:ml-64 min-h-[calc(100vh-4rem)]">
                <ErrorBoundary>
                  <div className="p-6 lg:p-8">{children}</div>
                </ErrorBoundary>
              </main>
            </div>
            <div className="md:ml-64">
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
