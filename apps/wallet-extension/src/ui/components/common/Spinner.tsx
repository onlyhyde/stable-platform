export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'white' | 'gray'
  className?: string
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

const colorStyles = {
  primary: 'spinner-primary',
  white: 'spinner-white',
  gray: 'spinner-muted',
}

export function Spinner({ size = 'md', color = 'primary', className = '' }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${sizeStyles[size]} ${colorStyles[color]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export interface LoadingOverlayProps {
  message?: string
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-50 backdrop-blur-sm"
      style={{ backgroundColor: 'rgb(var(--background) / 0.8)' }}
    >
      <Spinner size="lg" />
      {message && (
        <p className="mt-3 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {message}
        </p>
      )}
    </div>
  )
}
