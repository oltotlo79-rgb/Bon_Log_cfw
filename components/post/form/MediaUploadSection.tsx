'use client'

import Image from 'next/image'
import { X as XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Image as ImageIcon } from 'lucide-react'

type MediaFile = {
  url: string
  type: string
}

type MediaUploadSectionProps = {
  mediaFiles: MediaFile[]
  uploading: boolean
  uploadProgress: number
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (idx: number) => void
  /** ファイル入力要素への参照 */
  fileInputRef: React.RefObject<HTMLInputElement | null>
  maxTotal: number
  disabled?: boolean
}

/**
 * ファイル選択ボタン + プレビュー + プログレスバー（PostForm固有のアップロードUI）
 *
 * stateなし（純粋な表示コンポーネント）
 */
export function MediaUploadSection({
  mediaFiles,
  uploading,
  uploadProgress,
  onFileSelect,
  onRemove,
  fileInputRef,
  maxTotal,
  disabled,
}: MediaUploadSectionProps) {
  return (
    <>
      {/* メディアプレビュー */}
      {mediaFiles.length > 0 && (
        <div className={`grid gap-2 mt-3 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
          {mediaFiles.map((media, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {media.type === 'video' ? (
                <video src={media.url} className="w-full h-full object-cover" />
              ) : (
                <Image src={media.url} alt={`アップロード画像 ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 300px" className="object-cover" />
              )}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"
              >
                <XIcon className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ファイル選択入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
        onChange={onFileSelect}
        multiple
        className="hidden"
      />

      {/* メディア追加ボタン */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading || mediaFiles.length >= maxTotal}
      >
        <ImageIcon className="w-5 h-5" />
      </Button>

      {/* アップロード進捗 */}
      {uploading && (
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-bonsai-green transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
        </div>
      )}
    </>
  )
}
