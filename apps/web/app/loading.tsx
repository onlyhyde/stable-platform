export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-dark-200 dark:border-dark-700" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary-500 animate-spin" />
        </div>
        <p className="text-sm font-medium text-dark-500 dark:text-dark-400">Loading...</p>
      </div>
    </div>
  )
}
