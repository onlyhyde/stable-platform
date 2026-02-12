/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary - Purple (brand color)
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
        // Accent - Blue
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
        // Surface colors for extension
        surface: {
          base: '#0E0E12',
          raised: '#121216',
          DEFAULT: '#18181C',
          elevated: '#202126',
          overlay: '#000000',
        },
      },
      fontFamily: {
        sans: [
          'Space Grotesk',
          'Pretendard Variable',
          'Pretendard',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.03)',
        'glow-sm': '0 0 12px -3px rgba(124, 92, 252, 0.25)',
        glow: '0 0 20px -5px rgba(124, 92, 252, 0.35)',
        'glow-lg': '0 0 30px -5px rgba(124, 92, 252, 0.45)',
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
}
