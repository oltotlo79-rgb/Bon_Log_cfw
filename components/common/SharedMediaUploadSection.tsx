'use client'

/**
 * @module components/common/SharedMediaUploadSection
 * 複数フォーム共通のメディアアップロード UI。状態は useMediaUpload が持ち、ここは表示のみ。
 */

import Image from 'next/image'
import { X as XIcon, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SharedMediaFile = {
  url: string
  type: string
}

export interface SharedMediaUploadSectionProps {
  mediaFiles: SharedMediaFile[]
  uploading: boolean
  uploadProgress: number
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (index: number) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  maxTotal: number
  imagesOnly?: boolean
  disabled?: boolean
  buttonVariant?: 'ghost' | 'outline'
  buttonLabel?: string
  previewClassName?: string
  multiple?: boolean
}

export function SharedMediaUploadSection({
  mediaFiles,
  uploading,
  uploadProgress,
  onFileSelect,
  onRemove,
  fileInputRef,
  maxTotal,
  imagesOnly = false,
  disabled = false,
  buttonVariant = 'ghost',
  buttonLabel = '画像を追加',
  previewClassName,
  multiple = true,
}: SharedMediaUploadSectionProps) {
  const acceptTypes = imagesOnly
    ? 'image/*'
    : 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime'

  const isDisabled = disabled || uploading || mediaFiles.length >= maxTotal

  return (
    <>
      {mediaFiles.length > 0 && (
        <div className={previewClassName ?? `grid gap-2 ${mediaFiles.length === 1 ? '' : 'grid-cols-2'}`}>
          {mediaFiles.map((media, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {media.type === 'video' ? (
                <video src={media.url} className="w-full h-full object-cover" />
              ) : (
                <Image src={media.url} alt="アップロード画像のプレビュー" fill sizes="(max-width: 640px) 50vw, 300px" className="object-cover" />
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

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={onFileSelect}
        multiple={multiple}
        className="hidden"
      />

      {buttonVariant === 'outline' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          {buttonLabel}
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
        >
          <ImageIcon className="w-5 h-5" />
        </Button>
      )}

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
