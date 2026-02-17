export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }} />
        <div className="h-4 w-72 rounded-lg" style={{ backgroundColor: 'rgb(var(--secondary))' }} />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-xl border"
            style={{
              backgroundColor: 'rgb(var(--card))',
              borderColor: 'rgb(var(--border))',
            }}
          />
        ))}
      </div>

      {/* Content skeleton */}
      <div
        className="h-64 rounded-xl border"
        style={{
          backgroundColor: 'rgb(var(--card))',
          borderColor: 'rgb(var(--border))',
        }}
      />
    </div>
  )
}
