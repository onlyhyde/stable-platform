'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftElement?: ReactNode
  rightElement?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      leftElement,
      rightElement,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftElement && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full px-4 py-2.5 border rounded-lg transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              error
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500',
              leftElement ? 'pl-10' : undefined,
              rightElement ? 'pr-10' : undefined,
              'disabled:bg-gray-100 disabled:cursor-not-allowed',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-gray-500">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
