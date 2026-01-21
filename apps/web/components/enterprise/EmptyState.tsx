'use client'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 text-gray-300 mx-auto mb-4 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-gray-500">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      )}
    </div>
  )
}
