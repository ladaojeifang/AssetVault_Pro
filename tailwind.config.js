/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,js,jsx}', './src/preload/**/*.ts'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design Token - Dark Theme
        'av-bg-primary': '#0F1117',
        'av-bg-secondary': '#161822',
        'av-bg-tertiary': '#1E2030',
        'av-bg-elevated': '#252837',
        'av-bg-hover': '#2D3044',
        'av-bg-active': '#35384D',
        'av-text-primary': '#F1F5F9',
        'av-text-secondary': '#94A3B8',
        'av-text-muted': '#64748B',
        'av-accent-blue': '#3B82F6',
        'av-accent-blue-hover': '#2563EB',
        'av-accent-purple': '#8B5CF6',
        'av-accent-green': '#10B981',
        'av-accent-orange': '#F59E0B',
        'av-accent-red': '#EF4444',
        'av-border': '#2D3044',
        'av-border-light': '#3D4056'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace']
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.5rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        'xl-plus': ['1.125rem', { lineHeight: '1.75rem' }]
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem'
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'fade-out': 'fadeOut 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'spin-slow': 'spin 2s linear infinite'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' }
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          from: { transform: 'translateY(-8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
