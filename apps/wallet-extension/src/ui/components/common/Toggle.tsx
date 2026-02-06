export interface ToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

const sizeStyles = {
  sm: {
    track: 'w-8 h-4',
    thumb: 'w-3 h-3',
    translate: 'translate-x-4',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'w-5 h-5',
    translate: 'translate-x-5',
  },
}

export function Toggle({
  enabled,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
}: ToggleProps) {
  const styles = sizeStyles[size]

  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div className="flex-1 mr-4">
          {label && (
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              {label}
            </span>
          )}
          {description && (
            <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {description}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`
          relative inline-flex shrink-0 cursor-pointer rounded-full
          border-2 border-transparent transition-all-fast
          focus-ring-primary
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          ${styles.track}
        `}
        style={{
          backgroundColor: enabled ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
        }}
      >
        <span className="sr-only">{label ?? 'Toggle'}</span>
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block rounded-full bg-white shadow
            ring-0 transition-all-fast
            ${enabled ? styles.translate : 'translate-x-0'}
            ${styles.thumb}
          `}
        />
      </button>
    </div>
  )
}
