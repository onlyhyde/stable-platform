import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center text-center gap-4">
        <h1 className="text-6xl font-bold text-dark-300 dark:text-dark-600">404</h1>
        <h2 className="text-xl font-semibold text-dark-700 dark:text-dark-300">Page Not Found</h2>
        <p className="text-dark-500 dark:text-dark-400 max-w-md">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
