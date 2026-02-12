/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Purple (Primary)
        primary: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#7C5CFC',
          600: '#6B4FE0',
          700: '#5A3EC8',
          800: '#4C1D95',
          900: '#3B0764',
          950: '#1E0538',
        },
        // Blue (Accent)
        accent: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#4A7CFF',
          600: '#3B6AE8',
          700: '#2C5AD0',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        // Info Blue
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Success
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Dark scale
        dark: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0E0E12',
        },
        // Surface colors for dark theme
        surface: {
          base: '#0E0E12',
          raised: '#121216',
          DEFAULT: '#18181C',
          elevated: '#202126',
          overlay: '#27272f',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-space-grotesk)',
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'sans-serif',
        ],
        mono: [
          'var(--font-geist-mono)',
          'JetBrains Mono',
          'SF Mono',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(32, 33, 38, 0.5)',
        medium: '0 4px 12px -2px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(32, 33, 38, 0.5)',
        strong: '0 8px 24px -4px rgba(0, 0, 0, 0.25), 0 16px 48px -8px rgba(0, 0, 0, 0.2)',
        'glow-primary': '0 0 24px -4px rgba(124, 92, 252, 0.4)',
        'glow-accent': '0 0 24px -4px rgba(74, 124, 255, 0.4)',
        'glow-primary-lg': '0 0 40px -8px rgba(124, 92, 252, 0.5)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient':
          'linear-gradient(135deg, #4A7CFF 0%, #7C5CFC 25%, #A855F7 50%, #D946EF 75%, #3B82F6 100%)',
        'hero-gradient': 'linear-gradient(135deg, #3B82F6 0%, #7C5CFC 50%, #A855F7 100%)',
        'ambient-glow':
          'radial-gradient(ellipse at top, rgba(124, 92, 252, 0.15) 0%, transparent 60%)',
        'brand-gradient': 'linear-gradient(135deg, #4A7CFF 0%, #7C5CFC 50%, #D946EF 100%)',
        'cta-gradient': 'linear-gradient(135deg, #7C5CFC, #A855F7)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'gradient-x': 'gradientX 15s ease infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
}
