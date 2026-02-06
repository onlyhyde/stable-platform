import type { InputHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftElement?: ReactNode
  rightElement?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftElement, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
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
          <input
            ref={ref}
            id={inputId}
            className={`
              block w-full rounded-lg input-base
              px-3 py-2 text-sm
              transition-all-fast
              focus:outline-none
              ${leftElement ? 'pl-10' : ''}
              ${rightElement ? 'pr-10' : ''}
              ${className}
            `}
            style={{
              borderColor: error ? 'rgb(var(--destructive))' : undefined,
            }}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">{rightElement}</div>
          )}
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

Input.displayName = 'Input'

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'rgb(var(--foreground-secondary))' }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            block w-full rounded-lg input-base
            px-3 py-2 text-sm
            transition-all-fast
            focus:outline-none
            resize-none
            ${className}
          `}
          style={{
            borderColor: error ? 'rgb(var(--destructive))' : undefined,
          }}
          {...props}
        />
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

TextArea.displayName = 'TextArea'
