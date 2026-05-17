'use client'

/**
 * @module components/post/gallery/MediaItem
 * フィード一覧用のメディアセル。next/image による遅延読み込みとスケルトン表示。
 * 投稿の先頭メディア (LCP 候補) は `priority` を渡して eager 読込にする。
 */

import { useState } from 'react'
import Image from 'next/image'
import type { Media } from './types'

type Props = { media: Media; priority?: boolean; index?: number }

export function MediaItem({ media, priority = false, index = 0 }: Props) {
  const [isLoading, setIsLoading] = useState(true)

  if (media.type === 'video') {
    return (
      <video
        src={media.url}
        controls
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
      />
    )
  }

  return (
    <>
      {isLoading && <div className="absolute inset-0 bg-muted animate-pulse" />}
      <Image
        src={media.url}
        alt={`投稿画像 ${index + 1}`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"
        className={`object-cover hover:opacity-90 transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setIsLoading(false)}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />
    </>
  )
}
