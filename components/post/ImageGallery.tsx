'use client'

/**
 * @module components/post/ImageGallery
 * 投稿に添付された 1〜4 件の画像 / 動画を 16:9 グリッドで並べ、
 * クリックでモーダル拡大、Esc / 矢印キーで操作する。
 */

import { memo, useState, useRef, useCallback } from 'react'
import {
  X as XIcon,
  Maximize2 as ExpandIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'

import type { ImageGalleryProps } from './gallery/types'
import { MediaItem } from './gallery/MediaItem'
import { ModalMediaItem } from './gallery/ModalMediaItem'
import { useFocusTrap } from '@/hooks/use-focus-trap'

export type { Media, ImageGalleryProps } from './gallery/types'

export const ImageGallery = memo(function ImageGallery({ images, onMediaClick }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder)

  const gridClass = images.length === 1 ? '' : 'grid grid-cols-2 gap-1'

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex < sortedImages.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handleModalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null)
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) =>
          prev !== null && prev < sortedImages.length - 1 ? prev + 1 : prev,
        )
      }
    },
    [sortedImages.length],
  )

  useFocusTrap(modalRef, selectedIndex !== null)

  return (
    <>
      <div className={`${gridClass} rounded-lg overflow-hidden`}>
        {sortedImages.map((media, index) => {
          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (onMediaClick) {
              onMediaClick(media)
            } else {
              setSelectedIndex(index)
            }
          }

          if (media.type === 'video') {
            return (
              <div
                key={media.id}
                className={`relative block w-full bg-muted overflow-hidden ${
                  images.length === 3 && index === 0 ? 'row-span-2' : ''
                }`}
                style={{
                  paddingBottom: images.length === 3 && index === 0 ? '100%' : '56.25%',
                }}
              >
                <MediaItem media={media} priority={index === 0} index={index} />
                <button
                  onClick={handleClick}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors z-10"
                  title="拡大表示"
                >
                  <ExpandIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            )
          }

          return (
            <button
              key={media.id}
              onClick={handleClick}
              className={`relative block w-full bg-muted overflow-hidden ${
                images.length === 3 && index === 0 ? 'row-span-2' : ''
              }`}
              style={{
                paddingBottom: images.length === 3 && index === 0 ? '100%' : '56.25%',
              }}
            >
              <MediaItem media={media} priority={index === 0} index={index} />
            </button>
          )
        })}
      </div>

      {selectedIndex !== null && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="画像プレビュー"
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
          onKeyDown={handleModalKeyDown}
        >
          <button
            onClick={() => setSelectedIndex(null)}
            aria-label="閉じる"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
          >
            <XIcon className="w-6 h-6 text-white" />
          </button>

          {images.length > 1 && selectedIndex > 0 && (
            <button
              onClick={handlePrev}
              aria-label="前の画像"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
            >
              <ChevronLeftIcon className="w-6 h-6 text-white" />
            </button>
          )}

          {images.length > 1 && selectedIndex < sortedImages.length - 1 && (
            <button
              onClick={handleNext}
              aria-label="次の画像"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 z-10"
            >
              <ChevronRightIcon className="w-6 h-6 text-white" />
            </button>
          )}

          <div className="flex items-center justify-center max-w-4xl max-h-[90vh] w-full h-full p-4">
            {sortedImages[selectedIndex] && (
              <ModalMediaItem
                media={sortedImages[selectedIndex]}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {sortedImages.map((_, index) => (
                <button
                  key={index}
                  aria-label={`画像 ${index + 1} を表示`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedIndex(index)
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === selectedIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
})
