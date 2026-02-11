'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { docSections } from '@/lib/docs'
import { cn } from '@/lib/utils'

const iconMap: Record<string, React.ReactNode> = {
  rocket: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  shield: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  'credit-card': (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  ),
  'trending-up': (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  ),
  lock: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  ),
  code: (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  ),
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0">
        <div className="sticky top-6">
          <nav className="space-y-6">
            {docSections.map((section) => {
              const sectionPath = `/docs/${section.slug}`
              const isSectionActive = pathname.startsWith(sectionPath)

              return (
                <div key={section.slug}>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      style={{
                        color: isSectionActive
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--muted-foreground))',
                      }}
                    >
                      {iconMap[section.icon]}
                    </span>
                    <span
                      className="text-sm font-semibold uppercase tracking-wider"
                      style={{
                        color: isSectionActive
                          ? 'rgb(var(--primary))'
                          : 'rgb(var(--muted-foreground))',
                      }}
                    >
                      {section.title}
                    </span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {section.articles.map((article) => {
                      const articlePath = `/docs/${section.slug}/${article.slug}`
                      const isActive = pathname === articlePath

                      return (
                        <li key={article.slug}>
                          <Link
                            href={articlePath}
                            className={cn(
                              'block py-1.5 px-3 text-sm rounded-lg transition-colors',
                              isActive ? 'font-medium' : ''
                            )}
                            style={{
                              backgroundColor: isActive
                                ? 'rgb(var(--primary) / 0.1)'
                                : 'transparent',
                              color: isActive
                                ? 'rgb(var(--primary))'
                                : 'rgb(var(--muted-foreground))',
                            }}
                          >
                            {article.title}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
