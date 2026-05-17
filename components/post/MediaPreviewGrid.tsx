'use client'

import Image from 'next/image'
import type { MediaFile } from './hooks/useMediaUpload'

/**
 * バツ印アイコンコンポーネント（メディア削除ボタン用）
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * MediaPreviewGridのProps型
 *
 * @property mediaFiles - アップロードされたメディアファイルの配列
 * @property onRemove - メディアを削除するコールバック（インデックスを受け取る）
 * @property uploading - アップロード中かどうか（現在は未使用だが将来の拡張用に保持）
 */
type MediaPreviewGridProps = {
  mediaFiles: MediaFile[]
  onRemove: (index: number) => void
  uploading?: boolean
}

/**
 * メディアプレビューグリッドコンポーネント
 *
 * アップロードされた画像・動画をグリッド形式でプレビュー表示する。
 * 各メディアには削除ボタンが付く。
 */
export function MediaPreviewGrid({ mediaFiles, onRemove }: MediaPreviewGridProps) {
  if (mediaFiles.length === 0) return null

  return (
    <div className={`grid gap-2 mt-4 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
      {mediaFiles.map((media, index) => (
        <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
          {media.type === 'video' ? (
            <video src={media.url} className="w-full h-full object-cover" />
          ) : (
            <Image src={media.url} alt={`アップロード画像 ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 300px" className="object-cover" />
          )}
          {/* 削除ボタン */}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
          >
            <XIcon className="w-5 h-5 text-white" />
          </button>
        </div>
      ))}
    </div>
  )
}
