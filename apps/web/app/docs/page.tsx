'use client'

import { PageHeader } from '@/components/common'
import { docSections } from '@/lib/docs'
import Link from 'next/link'

const iconMap: Record<string, React.ReactNode> = {
  rocket: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  shield: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  'credit-card': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  ),
  'trending-up': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  ),
  lock: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  ),
  code: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  ),
}

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Documentation"
        description="Learn how to use StableNet's features and integrate with our platform"
      />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docSections.map((section) => (
          <Link
            key={section.slug}
            href={`/docs/${section.slug}/${section.articles[0]?.slug || ''}`}
            className="group p-6 rounded-2xl border transition-all duration-200 hover:shadow-lg"
            style={{
              borderColor: 'rgb(var(--border))',
              backgroundColor: 'rgb(var(--card))',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors"
              style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
            >
              <span style={{ color: 'rgb(var(--primary))' }}>{iconMap[section.icon]}</span>
            </div>
            <h3
              className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors"
              style={{ color: 'rgb(var(--foreground))' }}
            >
              {section.title}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {section.description}
            </p>
            <div className="space-y-1">
              {section.articles.slice(0, 3).map((article) => (
                <div
                  key={article.slug}
                  className="text-sm flex items-center gap-2"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  {article.title}
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Popular Articles */}
      <div>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'rgb(var(--foreground))' }}>
          Popular Articles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ArticleCard
            title="Quick Start Guide"
            description="Get up and running with StableNet in 5 minutes"
            href="/docs/getting-started/quick-start"
          />
          <ArticleCard
            title="Smart Account Overview"
            description="Learn about ERC-4337 smart accounts and their benefits"
            href="/docs/smart-account/overview"
          />
          <ArticleCard
            title="Session Keys"
            description="Enable seamless dApp interactions with temporary permissions"
            href="/docs/smart-account/session-keys"
          />
          <ArticleCard
            title="Security Best Practices"
            description="Keep your account and assets secure"
            href="/docs/security/best-practices"
          />
        </div>
      </div>
    </div>
  )
}

function ArticleCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="p-4 rounded-xl border transition-all duration-200 hover:border-primary/50"
      style={{
        borderColor: 'rgb(var(--border))',
        backgroundColor: 'rgb(var(--secondary) / 0.5)',
      }}
    >
      <h3 className="font-medium mb-1" style={{ color: 'rgb(var(--foreground))' }}>
        {title}
      </h3>
      <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
        {description}
      </p>
    </Link>
  )
}
