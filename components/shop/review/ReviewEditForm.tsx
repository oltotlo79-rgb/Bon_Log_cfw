'use client'

/**
 * @file ReviewEditForm.tsx
 * @description レビュー編集フォームコンポーネント
 *
 * 評価、コメント、画像の編集フォームを提供します。
 */

import Image from 'next/image'
import { StarRatingInput } from '../StarRating'
import { MAX_REVIEW_IMAGES } from '@/lib/constants/limits'

/**
 * Xアイコンコンポーネント
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * 画像アイコンコンポーネント
 */
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

interface ReviewEditFormProps {
  /** 編集中の評価値 */
  editRating: number
  onRatingChange: (rating: number) => void
  /** 編集中のコメント */
  editContent: string
  onContentChange: (content: string) => void
  /** 既存の画像リスト */
  existingImages: { id: string; url: string }[]
  /** 削除対象としてマークされた画像IDの配列 */
  deleteImageIds: string[]
  onDeleteExistingImage: (imageId: string) => void
  onRestoreExistingImage: (imageId: string) => void
  /** 新規追加する画像URLの配列 */
  newImages: string[]
  onRemoveNewImage: (index: number) => void
  /** 現在の合計画像数 */
  totalImageCount: number
  /** 画像アップロード中の状態 */
  uploading: boolean
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** エラーメッセージ */
  editError: string | null
  /** 保存処理中かどうか */
  isPending: boolean
  onSave: () => void
  onCancel: () => void
}

/**
 * レビュー編集フォームコンポーネント
 */
export function ReviewEditForm({
  editRating,
  onRatingChange,
  editContent,
  onContentChange,
  existingImages,
  deleteImageIds,
  onDeleteExistingImage,
  onRestoreExistingImage,
  newImages,
  onRemoveNewImage,
  totalImageCount,
  uploading,
  onImageUpload,
  editError,
  isPending,
  onSave,
  onCancel,
}: ReviewEditFormProps) {
  return (
    <div className="space-y-3">
      {/* エラーメッセージ */}
      {editError && (
        <p className="text-sm text-destructive">{editError}</p>
      )}

      {/* 評価入力 */}
      <div>
        <label className="text-sm font-medium mb-1 block">評価</label>
        <StarRatingInput value={editRating} onChange={onRatingChange} />
      </div>

      {/* コメント入力 */}
      <div>
        <label className="text-sm font-medium mb-1 block">コメント</label>
        <textarea
          value={editContent}
          onChange={(e) => onContentChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
          placeholder="レビューコメント（任意）"
        />
      </div>

      {/* 画像編集エリア */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          画像 ({totalImageCount}/{MAX_REVIEW_IMAGES}枚)
        </label>

        {/* 既存の画像 */}
        {existingImages.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {existingImages.map((image) => {
              const isMarkedForDelete = deleteImageIds.includes(image.id)
              return (
                <div key={image.id} className="relative w-20 h-20">
                  <Image
                    src={image.url}
                    alt="レビュー画像"
                    fill
                    className={`object-cover rounded-lg ${isMarkedForDelete ? 'opacity-30' : ''}`}
                  />
                  {isMarkedForDelete ? (
                    <button
                      type="button"
                      onClick={() => onRestoreExistingImage(image.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg text-white text-xs"
                    >
                      元に戻す
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDeleteExistingImage(image.id)}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 新しく追加する画像（プレビュー） */}
        {newImages.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {newImages.map((url, index) => (
              <div key={`new-${index}`} className="relative w-20 h-20">
                <Image
                  src={url}
                  alt={`新規画像 ${index + 1}`}
                  fill
                  className="object-cover rounded-lg border-2 border-primary"
                />
                <button
                  type="button"
                  onClick={() => onRemoveNewImage(index)}
                  className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                >
                  <XIcon className="w-3 h-3" />
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-xs text-center py-0.5 rounded-b-lg">
                  新規
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 画像追加ボタン */}
        <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted ${totalImageCount >= MAX_REVIEW_IMAGES || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <ImageIcon className="w-4 h-4" />
          <span className="text-sm">
            {uploading ? 'アップロード中...' : '画像を追加'}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            disabled={totalImageCount >= MAX_REVIEW_IMAGES || uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* 保存・キャンセルボタン */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending || uploading}
          className="px-3 py-1 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || uploading}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
