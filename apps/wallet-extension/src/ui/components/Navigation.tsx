import type React from 'react'
import { useTranslation } from 'react-i18next'
import { useWalletStore } from '../hooks/useWalletStore'

type Page = 'home' | 'send' | 'modules' | 'activity' | 'settings'

interface NavItem {
  id: Page
  labelKey: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    id: 'home',
    labelKey: 'home',
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
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    id: 'send',
    labelKey: 'send',
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
          strokeWidth={2}
          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
        />
      </svg>
    ),
  },
  {
    id: 'modules',
    labelKey: 'modules',
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
          strokeWidth={2}
          d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
        />
      </svg>
    ),
  },
  {
    id: 'activity',
    labelKey: 'activity',
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
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  {
    id: 'settings',
    labelKey: 'settings',
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
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
]

const NAV_LABELS: Record<string, string> = {
  home: 'Home',
  send: 'Send',
  modules: 'Modules',
  activity: 'Activity',
  settings: 'Settings',
}

export function Navigation() {
  const { currentPage, setPage } = useWalletStore()
  const { t } = useTranslation('common')

  const getLabel = (key: string) => {
    // Navigation labels mapped from common namespace
    const labelMap: Record<string, string> = {
      home: t('home', 'Home'),
      send: t('send'),
      modules: t('modules', 'Modules'),
      activity: t('activity', 'Activity'),
      settings: t('settings', 'Settings'),
    }
    return labelMap[key] ?? NAV_LABELS[key] ?? key
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20"
      style={{
        backgroundColor: 'rgb(var(--background-raised))',
        borderTop: '1px solid rgb(var(--border))',
      }}
    >
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all-fast ${
                isActive ? 'nav-active-glow' : ''
              }`}
              style={{
                color: isActive ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
              }}
            >
              <span
                className="transition-all-fast"
                style={{
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-xs mt-1 transition-all-fast"
                style={{
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {getLabel(item.labelKey)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
