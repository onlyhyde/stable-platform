'use client'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div
        className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
        style={{ color: 'rgb(var(--muted-foreground) / 0.5)' }}
      >
        {icon}
      </div>
      <p style={{ color: 'rgb(var(--muted-foreground))' }}>{title}</p>
      {description && (
        <p className="text-sm mt-1" style={{ color: 'rgb(var(--muted-foreground) / 0.7)' }}>
          {description}
        </p>
      )}
    </div>
  )
}
