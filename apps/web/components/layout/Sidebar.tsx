'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NetworkSelector } from '@/components/common'
import { useBalance, useWallet } from '@/hooks'
import { cn, formatTokenAmount } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ReactNode
  badge?: string
  badgeVariant?: 'primary' | 'accent' | 'success' | 'warning'
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"
        />
      </svg>
    ),
  },
  {
    name: 'Smart Account',
    href: '/smart-account',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    name: 'Payment',
    href: '/payment',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    ),
  },
  {
    name: 'Buy',
    href: '/buy',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    name: 'Bank',
    href: '/bank',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"
        />
      </svg>
    ),
  },
  {
    name: 'DeFi',
    href: '/defi',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
  {
    name: 'Stealth',
    href: '/stealth',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    ),
  },
  {
    name: 'Subscription',
    href: '/subscription',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  {
    name: 'Marketplace',
    href: '/marketplace',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
  },
  {
    name: 'Enterprise',
    href: '/enterprise',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
]

const bottomNavigation: NavItem[] = [
  {
    name: 'Docs',
    href: '/docs',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { address, isConnected } = useWallet()
  const { balance, symbol, decimals } = useBalance({ address, watch: true })

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [mobileOpen])

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto scrollbar-thin">
        {/* Section Label */}
        <span
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          Main Menu
        </span>

        {navigation.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group relative'
              )}
              style={{
                backgroundColor: isActive ? 'rgb(var(--sidebar-active))' : 'transparent',
                color: isActive
                  ? 'rgb(var(--sidebar-active-foreground))'
                  : 'rgb(var(--sidebar-foreground))',
              }}
            >
              {/* Active Indicator */}
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                  style={{ backgroundColor: 'rgb(var(--primary))' }}
                />
              )}

              <span
                className="transition-colors duration-200"
                style={{
                  color: isActive ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
                }}
              >
                {item.icon}
              </span>

              <span className="flex-1">{item.name}</span>

              {item.badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-2xs font-semibold rounded-full',
                    item.badgeVariant === 'primary' && 'badge-primary',
                    item.badgeVariant === 'accent' && 'badge-accent',
                    item.badgeVariant === 'success' && 'badge-success',
                    item.badgeVariant === 'warning' && 'badge-warning'
                  )}
                >
                  {item.badge}
                </span>
              )}

              {/* Hover Arrow */}
              <svg
                className={cn(
                  'w-4 h-4 transition-all duration-200',
                  isActive
                    ? 'opacity-100'
                    : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                )}
                style={{
                  color: isActive ? 'rgb(var(--primary) / 0.7)' : 'rgb(var(--muted-foreground))',
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="px-4">
        <div className="divider" />
      </div>

      {/* Bottom Navigation */}
      <nav className="p-4">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group"
              style={{
                backgroundColor: isActive ? 'rgb(var(--secondary))' : 'transparent',
                color: isActive ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
              }}
            >
              <span
                className="transition-colors"
                style={{
                  color: isActive ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
                }}
              >
                {item.icon}
              </span>
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-[1.125rem] left-4 z-50 p-2 rounded-lg md:hidden"
        style={{
          backgroundColor: 'rgb(var(--card))',
          border: '1px solid rgb(var(--border))',
          color: 'rgb(var(--foreground))',
        }}
        aria-label="Open menu"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Desktop Sidebar */}
      <aside
        className="fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 border-r bg-[rgb(var(--sidebar))/0.8] backdrop-blur-xl hidden md:block"
        style={{ borderColor: 'rgb(var(--sidebar-border))' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm w-full h-full border-none cursor-default"
            onClick={() => setMobileOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setMobileOpen(false)}
            aria-label="Close menu"
          />
          {/* Sidebar Panel */}
          <aside
            className="fixed left-0 top-0 h-full w-64 border-r backdrop-blur-xl"
            style={{
              backgroundColor: 'rgb(var(--sidebar))',
              borderColor: 'rgb(var(--sidebar-border))',
            }}
          >
            {/* Close button */}
            <div
              className="flex items-center justify-between h-16 px-4 border-b"
              style={{ borderColor: 'rgb(var(--sidebar-border))' }}
            >
              <span className="font-bold text-lg" style={{ color: 'rgb(var(--foreground))' }}>
                Menu
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg"
                style={{ color: 'rgb(var(--muted-foreground))' }}
                aria-label="Close menu"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Mobile-only: Network & Balance */}
            <div
              className="px-4 py-3 border-b space-y-3"
              style={{ borderColor: 'rgb(var(--sidebar-border))' }}
            >
              <NetworkSelector />
              {isConnected && address && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: 'rgb(var(--secondary))',
                    border: '1px solid rgb(var(--border))',
                  }}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[rgb(var(--info))] to-[rgb(var(--info-muted))] flex items-center justify-center">
                    <span className="text-2xs font-bold text-white">Ξ</span>
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'rgb(var(--foreground))' }}
                  >
                    {formatTokenAmount(balance, decimals)}
                  </span>
                  <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {symbol}
                  </span>
                </div>
              )}
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
