'use client'

/**
 * @module components/common/OptimizedImage
 * Next.js Image をラップし、読み込み中のパルススケルトンとエラー時のフォールバック
 * を提供する。LCP 画像には `priority` を渡す (Next.js は内部で `<link rel="preload">`
 * とフェッチ優先度を上げる)。
 */

import Image from 'next/image'
import { useState } from 'react'

type OptimizedImageProps = {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  sizes?: string
  /** LCP 画像なら true。next/image の `priority` として渡し、eager loading + 高優先度プリロードを行う。 */
  priority?: boolean
  className?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none'
  onClick?: (e: React.MouseEvent) => void
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  sizes = '100vw',
  priority = false,
  className = '',
  objectFit = 'cover',
  onClick,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div
        className={`bg-muted flex items-center justify-center ${className}`}
        style={fill ? { position: 'absolute', inset: 0 } : { width, height }}
      >
        <svg
          className="w-8 h-8 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  const objectFitClass = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
  }[objectFit]

  return (
    <div
      className={`relative ${fill ? '' : 'inline-block'}`}
      style={fill ? undefined : { width, height }}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" style={{ zIndex: 1 }} />
      )}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        sizes={sizes}
        priority={priority}
        className={`${objectFitClass} ${className} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        onClick={onClick}
        loading={priority ? undefined : 'lazy'}
      />
    </div>
  )
}
