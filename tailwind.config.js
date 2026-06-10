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
        'av-accent-blue-pressed': 'var(--av-accent-blue-pressed)',
        'av-accent-purple': 'var(--av-accent-purple)',
        'av-accent-green': 'var(--av-accent-green)',
        'av-accent-orange': 'var(--av-accent-orange)',
        'av-accent-red': 'var(--av-accent-red)',
        'av-border': 'var(--av-border)',
        'av-border-light': 'var(--av-border-light)',
        'av-status-success': 'var(--av-status-success)',
        'av-status-success-muted-bg': 'var(--av-status-success-muted-bg)',
        'av-status-success-muted-text': 'var(--av-status-success-muted-text)',
        'av-status-error': 'var(--av-status-error)',
        'av-status-error-muted-bg': 'var(--av-status-error-muted-bg)',
        'av-status-error-muted-text': 'var(--av-status-error-muted-text)',
        'av-status-warning': 'var(--av-status-warning)',
        'av-status-warning-muted-bg': 'var(--av-status-warning-muted-bg)',
        'av-status-warning-muted-text': 'var(--av-status-warning-muted-text)',
        'av-status-info-muted-bg': 'var(--av-status-info-muted-bg)',
        'av-status-info-muted-text': 'var(--av-status-info-muted-text)',
        'av-badge-catalog-bg': 'var(--av-badge-catalog-bg)',
        'av-badge-catalog-text': 'var(--av-badge-catalog-text)',
        'av-badge-catalog-border': 'var(--av-badge-catalog-border)',
        'av-badge-embedded-bg': 'var(--av-badge-embedded-bg)',
        'av-badge-embedded-text': 'var(--av-badge-embedded-text)',
        'av-badge-embedded-border': 'var(--av-badge-embedded-border)',
        'av-badge-archive-bg': 'var(--av-badge-archive-bg)',
        'av-badge-archive-text': 'var(--av-badge-archive-text)',
        'av-badge-archive-border': 'var(--av-badge-archive-border)',
        'av-media-overlay-backdrop': 'var(--av-media-overlay-backdrop)',
        'av-media-overlay-scrim': 'var(--av-media-overlay-scrim)',
        'av-media-overlay-hover': 'var(--av-media-overlay-hover)',
        'av-media-overlay-chip': 'var(--av-media-overlay-chip)',
        'av-media-overlay-text': 'var(--av-media-overlay-text)',
        'av-media-overlay-text-muted': 'var(--av-media-overlay-text-muted)',
        'av-media-overlay-text-faint': 'var(--av-media-overlay-text-faint)',
        'av-media-overlay-text-dim': 'var(--av-media-overlay-text-dim)',
        'av-media-overlay-border': 'var(--av-media-overlay-border)',
        'av-media-overlay-badge-bg': 'var(--av-media-overlay-badge-bg)',
        'av-media-overlay-badge-text': 'var(--av-media-overlay-badge-text)',
        'av-error-boundary-bg': 'var(--av-error-boundary-bg)',
        'av-error-boundary-text': 'var(--av-error-boundary-text)',
        'av-error-boundary-detail': 'var(--av-error-boundary-detail)'
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
