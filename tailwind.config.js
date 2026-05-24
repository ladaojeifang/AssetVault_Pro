/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,js,jsx}', './src/preload/**/*.ts'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'av-bg-primary': 'var(--av-bg-primary)',
        'av-bg-secondary': 'var(--av-bg-secondary)',
        'av-bg-tertiary': 'var(--av-bg-tertiary)',
        'av-bg-elevated': 'var(--av-bg-elevated)',
        'av-bg-hover': 'var(--av-bg-hover)',
        'av-bg-active': 'var(--av-bg-active)',
        'av-text-primary': 'var(--av-text-primary)',
        'av-text-secondary': 'var(--av-text-secondary)',
        'av-text-muted': 'var(--av-text-muted)',
        'av-accent-blue': 'var(--av-accent-blue)',
        'av-accent-blue-hover': 'var(--av-accent-blue-hover)',
        'av-accent-purple': '#8B5CF6',
        'av-accent-green': '#10B981',
        'av-accent-orange': '#F59E0B',
        'av-accent-red': '#EF4444',
        'av-border': 'var(--av-border)',
        'av-border-light': 'var(--av-border-light)'
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
