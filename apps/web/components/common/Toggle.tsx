import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Toggle({ checked, onChange, disabled = false, className }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative w-12 h-6 rounded-full transition-colors duration-150',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={{
        backgroundColor: checked ? 'rgb(var(--primary))' : 'rgb(var(--secondary))',
      }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-150',
          checked ? 'left-7' : 'left-1'
        )}
      />
    </button>
  )
}

interface ToggleCardProps {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function ToggleCard({ title, description, checked, onChange, disabled }: ToggleCardProps) {
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl border"
      style={{
        backgroundColor: 'rgb(var(--card))',
        borderColor: 'rgb(var(--border))',
      }}
    >
      <div>
        <p className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>
          {title}
        </p>
        <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
          {description}
        </p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
