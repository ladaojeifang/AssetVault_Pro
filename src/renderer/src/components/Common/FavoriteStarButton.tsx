import React from 'react'
import { useTranslation } from 'react-i18next'

type FavoriteStarButtonProps = {
  isFavorite: boolean
  onToggle: () => void
  className?: string
  size?: 'sm' | 'md'
}

export const FavoriteStarButton: React.FC<FavoriteStarButtonProps> = ({
  isFavorite,
  onToggle,
  className = '',
  size = 'md'
}) => {
  const { t } = useTranslation('assets')
  const dim = size === 'sm' ? 14 : 16

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`flex items-center justify-center rounded-md transition-colors ${
        isFavorite
          ? 'text-av-accent-blue opacity-100'
          : 'text-av-media-overlay-text opacity-0 group-hover:opacity-100 hover:text-av-accent-blue'
      } ${className}`}
      aria-label={isFavorite ? t('removeFavorite') : t('addFavorite')}
      title={isFavorite ? t('removeFavorite') : t('addFavorite')}
    >
      <svg width={dim} height={dim} viewBox="0 0 24 24" aria-hidden>
        {isFavorite ? (
          <path
            d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z"
            fill="currentColor"
          />
        ) : (
          <path
            d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}
