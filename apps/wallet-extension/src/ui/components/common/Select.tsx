import type { ReactNode, SelectHTMLAttributes } from 'react'
import { forwardRef } from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  leftElement?: ReactNode
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, hint, options, leftElement, placeholder, className = '', id, ...props },
    ref
  ) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftElement && (
            <div
              className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              {leftElement}
            </div>
          )}
          <select
            ref={ref}
            id={selectId}
            className={`
              block w-full rounded-lg appearance-none input-base
              px-3 py-2 text-sm
              focus:outline-none
              ${leftElement ? 'pl-10' : ''}
              pr-10
              ${className}
            `}
            style={{
              borderColor: error ? 'rgb(var(--destructive))' : undefined,
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div
            className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm" style={{ color: 'rgb(var(--destructive))' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
