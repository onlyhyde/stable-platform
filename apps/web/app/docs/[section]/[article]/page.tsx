'use client'

import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { docSections, getDocArticle, getDocSection } from '@/lib/docs'

export default function ArticlePage() {
  const params = useParams()
  const sectionSlug = params.section as string
  const articleSlug = params.article as string

  const section = getDocSection(sectionSlug)
  const article = getDocArticle(sectionSlug, articleSlug)

  if (!section || !article) {
    notFound()
  }

  // Find prev/next articles
  const allArticles = docSections.flatMap((s) =>
    s.articles.map((a) => ({ section: s, article: a }))
  )
  const currentIndex = allArticles.findIndex(
    (item) => item.section.slug === sectionSlug && item.article.slug === articleSlug
  )
  const prevArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null
  const nextArticle = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link
          href="/docs"
          className="transition-colors"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          Docs
        </Link>
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>/</span>
        <Link
          href={`/docs/${section.slug}/${section.articles[0]?.slug || ''}`}
          className="transition-colors"
          style={{ color: 'rgb(var(--muted-foreground))' }}
        >
          {section.title}
        </Link>
        <span style={{ color: 'rgb(var(--muted-foreground))' }}>/</span>
        <span style={{ color: 'rgb(var(--foreground))' }}>{article.title}</span>
      </nav>

      {/* Article Content */}
      <article className="prose prose-invert max-w-none">
        <div
          className="doc-content"
          style={{ color: 'rgb(var(--foreground))' }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown content is sanitized
          dangerouslySetInnerHTML={{ __html: parseMarkdown(article.content) }}
        />
      </article>

      {/* Navigation */}
      <div
        className="flex items-center justify-between mt-12 pt-6 border-t"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        {prevArticle ? (
          <Link
            href={`/docs/${prevArticle.section.slug}/${prevArticle.article.slug}`}
            className="flex items-center gap-2 p-3 rounded-lg transition-colors"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <div className="text-left">
              <div className="text-xs uppercase tracking-wider">Previous</div>
              <div className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {prevArticle.article.title}
              </div>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {nextArticle && (
          <Link
            href={`/docs/${nextArticle.section.slug}/${nextArticle.article.slug}`}
            className="flex items-center gap-2 p-3 rounded-lg transition-colors text-right"
            style={{ color: 'rgb(var(--muted-foreground))' }}
          >
            <div>
              <div className="text-xs uppercase tracking-wider">Next</div>
              <div className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                {nextArticle.article.title}
              </div>
            </div>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}

// Simple markdown parser
function parseMarkdown(content: string): string {
  return (
    content
      // Headers
      .replace(
        /^### (.*$)/gim,
        '<h3 class="text-lg font-semibold mt-6 mb-3" style="color: rgb(var(--foreground))">$1</h3>'
      )
      .replace(
        /^## (.*$)/gim,
        '<h2 class="text-xl font-semibold mt-8 mb-4" style="color: rgb(var(--foreground))">$1</h2>'
      )
      .replace(
        /^# (.*$)/gim,
        '<h1 class="text-2xl font-bold mb-6" style="color: rgb(var(--foreground))">$1</h1>'
      )
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        '<pre class="p-4 rounded-lg overflow-x-auto my-4" style="background-color: rgb(var(--secondary))"><code class="text-sm font-mono" style="color: rgb(var(--foreground))">$2</code></pre>'
      )
      // Inline code
      .replace(
        /`([^`]+)`/g,
        '<code class="px-1.5 py-0.5 rounded text-sm font-mono" style="background-color: rgb(var(--secondary)); color: rgb(var(--primary))">$1</code>'
      )
      // Links
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-primary hover:underline">$1</a>'
      )
      // Unordered lists
      .replace(
        /^- (.*$)/gim,
        '<li class="ml-4" style="color: rgb(var(--muted-foreground))">$1</li>'
      )
      // Ordered lists
      .replace(
        /^\d+\. (.*$)/gim,
        '<li class="ml-4" style="color: rgb(var(--muted-foreground))">$1</li>'
      )
      // Tables
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter((c) => c.trim())
        if (cells.some((c) => c.match(/^-+$/))) {
          return ''
        }
        const isHeader = match.includes('---')
        const tag = isHeader ? 'th' : 'td'
        return `<tr>${cells.map((c) => `<${tag} class="px-4 py-2 border" style="border-color: rgb(var(--border))">${c.trim()}</${tag}>`).join('')}</tr>`
      })
      // Paragraphs
      .replace(/\n\n/g, '</p><p class="my-4" style="color: rgb(var(--muted-foreground))">')
      // Wrap in paragraph
      .replace(/^(.+)$/gm, (match) => {
        if (match.startsWith('<')) return match
        return `<p class="my-4" style="color: rgb(var(--muted-foreground))">${match}</p>`
      })
      // Clean up empty paragraphs
      .replace(/<p[^>]*><\/p>/g, '')
      .replace(/<p[^>]*>\s*<\/p>/g, '')
  )
}
