'use client'

/**
 * @module components/post/gallery/ModalMediaItem
 * 拡大モーダル内で 1 枚の画像 / 動画を全画面表示する。動画は autoplay。
 */

import Image from 'next/image'
import type { Media } from './types'

type Props = { media: Media; onClick: (e: React.MouseEvent) => void }

export function ModalMediaItem({ media, onClick }: Props) {
  if (media.type === 'video') {
    return (
      <video
        src={media.url}
        controls
        className="max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
        autoPlay
      />
    )
  }

  return (
    <div className="relative max-w-full max-h-full" style={{ width: '100%', height: '100%' }}>
      <Image
        src={media.url}
        alt="投稿画像の拡大表示"
        fill
        sizes="100vw"
        className="object-contain"
        onClick={onClick}
        priority
      />
    </div>
  )
}
