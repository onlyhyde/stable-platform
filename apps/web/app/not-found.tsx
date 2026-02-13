import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'rgb(var(--secondary))' }}
      >
        <span className="text-4xl font-bold" style={{ color: 'rgb(var(--muted-foreground))' }}>
          404
        </span>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>
          Page Not Found
        </h1>
        <p className="max-w-md" style={{ color: 'rgb(var(--muted-foreground))' }}>
          The page you are looking for does not exist or has been moved.
        </p>
      </div>

      <Link
        href="/"
        className="px-6 py-3 rounded-xl font-medium transition-colors"
        style={{
          backgroundColor: 'rgb(var(--primary))',
          color: 'rgb(var(--primary-foreground))',
        }}
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
