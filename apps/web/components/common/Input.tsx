'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftElement?: ReactNode
  rightElement?: ReactNode
  variant?: 'default' | 'glass' | 'filled'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, hint, leftElement, rightElement, variant = 'default', id, ...props },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold mb-2"
            style={{ color: 'rgb(var(--foreground))' }}
          >
            {label}
          </label>
        )}
        <div className="relative group">
          {leftElement && (
            <div
              className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full px-4 py-3 rounded-xl transition-all duration-150',
              'placeholder:text-[rgb(var(--muted-foreground))]',
              'focus:outline-none focus:ring-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
              leftElement ? 'pl-11' : '',
              rightElement ? 'pr-11' : '',
              className
            )}
            style={{
              backgroundColor: error ? 'rgb(var(--destructive) / 0.05)' : 'rgb(var(--background))',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: error ? 'rgb(var(--destructive))' : 'rgb(var(--border))',
              color: 'rgb(var(--foreground))',
            }}
            {...props}
          />
          {rightElement && (
            <div
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
              style={{ color: 'rgb(var(--muted-foreground))' }}
            >
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p
            className="mt-2 text-sm flex items-center gap-1.5"
            style={{ color: 'rgb(var(--destructive))' }}
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-2 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
