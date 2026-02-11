'use client'

import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Using CSS variable-based styles for theme support
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--primary-hover)))',
        color: 'rgb(var(--primary-foreground))',
      },
      secondary: {
        backgroundColor: 'rgb(var(--secondary))',
        color: 'rgb(var(--secondary-foreground))',
        border: '1px solid rgb(var(--border))',
      },
      accent: {
        background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-hover)))',
        color: 'rgb(var(--accent-foreground))',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'rgb(var(--muted-foreground))',
      },
      danger: {
        background: 'linear-gradient(135deg, rgb(var(--error)), rgb(var(--error-hover)))',
        color: 'white',
      },
      outline: {
        backgroundColor: 'transparent',
        color: 'rgb(var(--primary))',
        border: '2px solid rgb(var(--primary))',
      },
    }

    const variants = {
      primary: 'hover:shadow-glow-primary active:opacity-90',
      secondary: 'hover:opacity-80',
      accent: 'hover:shadow-glow-accent active:opacity-90',
      ghost: 'hover:bg-dark-100 dark:hover:bg-dark-800',
      danger: 'hover:shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)] active:opacity-90',
      outline: 'hover:bg-[rgb(var(--primary))] hover:text-white',
    }

    const sizes = {
      sm: 'px-3 py-2 text-sm gap-1.5',
      md: 'px-5 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
      xl: 'px-8 py-4 text-lg gap-2.5',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold',
          'rounded-xl transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'active:scale-[0.98]',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        style={variantStyles[variant]}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
