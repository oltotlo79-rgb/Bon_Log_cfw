'use client'

/**
 * @file SharedMediaUploadSection.tsx
 * @description 共通メディアアップロードセクションコンポーネント
 *
 * 複数のフォーム（DraftEditForm, ScheduledPostForm, ReviewCard, CommentForm, PostForm）
 * で共通のメディアアップロードUIを提供します。
 * アップロード状態はフック（useMediaUpload）で管理し、このコンポーネントは
 * UIの表示を担当します。
 */

import Image from 'next/image'
import { X as XIcon, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SharedMediaFile = {
  url: string
  type: string
}

export interface SharedMediaUploadSectionProps {
  /** アップロード済みファイル一覧 */
  mediaFiles: SharedMediaFile[]
  /** アップロード中かどうか */
  uploading: boolean
  /** アップロード進捗（0-100） */
  uploadProgress: number
  /** ファイル選択ハンドラ */
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** メディア削除ハンドラ */
  onRemove: (index: number) => void
  /** ファイル入力要素への参照 */
  fileInputRef: React.RefObject<HTMLInputElement | null>
  /** 最大添付数合計（画像+動画） */
  maxTotal: number
  /** 画像のみ許可するか（falseの場合は画像+動画） */
  imagesOnly?: boolean
  /** 無効化フラグ */
  disabled?: boolean
  /** ボタンの表示スタイル（'ghost'=アイコンのみ, 'outline'=テキスト付き） */
  buttonVariant?: 'ghost' | 'outline'
  /** ボタンのテキスト（buttonVariant='outline'の場合に使用） */
  buttonLabel?: string
  /** プレビューグリッドの追加クラス */
  previewClassName?: string
  /** ファイル選択を複数許可するか */
  multiple?: boolean
}

/**
 * 共通メディアアップロードセクションコンポーネント
 *
 * プレビュー表示、削除ボタン、ファイル選択ボタン、プログレスバーを提供します。
 * 状態管理は親コンポーネントで行い、このコンポーネントはUIのみを担当します。
 */
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
      {/* メディアプレビューグリッド */}
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

      {/* 非表示ファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={onFileSelect}
        multiple={multiple}
        className="hidden"
      />

      {/* ファイル選択ボタン */}
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

      {/* アップロード進捗バー */}
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
