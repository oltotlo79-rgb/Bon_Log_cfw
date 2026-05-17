'use client'

/**
 * @file ReviewCard.tsx
 * @description 個別レビューカードコンポーネント（オーケストレーター）
 *
 * 機能概要:
 * - レビューの詳細（評価、コメント、画像）を表示
 * - 投稿者情報と投稿日時を表示
 * - 自分のレビューの場合は編集・削除機能を提供
 * - 他人のレビューの場合は通報ボタンを表示
 * - 編集モードでは評価、コメント、画像の変更が可能
 * - 画像のアップロード・削除機能を実装
 *
 * 使用例:
 * ```tsx
 * <ReviewCard
 *   review={reviewData}
 *   currentUserId={session?.user?.id}
 * />
 * ```
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteReview, updateReview } from '@/lib/actions/review'
import { prepareFileForUpload, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'
import { MAX_REVIEW_IMAGES, DEFAULT_COMPRESSION_MAX_SIZE_MB, MAX_IMAGE_DIMENSION } from '@/lib/constants/limits'
import { ReviewDisplay } from './review/ReviewDisplay'
import { ReviewEditForm } from './review/ReviewEditForm'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * ReviewCardコンポーネントのプロパティ定義
 */
interface ReviewCardProps {
  /** レビューデータ */
  review: {
    /** レビューID */
    id: string
    /** 評価（1〜5） */
    rating: number
    /** コメント（任意） */
    content: string | null
    /** 投稿日時 */
    createdAt: Date | string
    /** 投稿者情報 */
    user: {
      /** ユーザーID */
      id: string
      /** ニックネーム */
      nickname: string
      /** アバター画像URL */
      avatarUrl: string | null
    }
    /** 添付画像の配列 */
    images: { id: string; url: string }[]
  }
  /** 現在ログインしているユーザーのID */
  currentUserId?: string
}

/**
 * 個別レビューカードコンポーネント
 *
 * 表示モードと編集モードを切り替え、各モードに対応する
 * サブコンポーネントに処理を委譲します。
 */
export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 削除確認ダイアログの表示状態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 編集モードの状態
  const [isEditing, setIsEditing] = useState(false)

  // 編集中の評価値
  const [editRating, setEditRating] = useState(review.rating)

  // 編集中のコメント
  const [editContent, setEditContent] = useState(review.content || '')

  // 編集時のエラーメッセージ
  const [editError, setEditError] = useState<string | null>(null)

  // 既存の画像リスト
  const [existingImages, setExistingImages] = useState(review.images)

  // 削除対象としてマークされた画像IDの配列
  const [deleteImageIds, setDeleteImageIds] = useState<string[]>([])

  // 新規追加する画像URLの配列
  const [newImages, setNewImages] = useState<string[]>([])

  // 画像アップロード中の状態
  const [uploading, setUploading] = useState(false)

  const isOwner = currentUserId === review.user.id

  // 現在の合計画像数
  const remainingExistingCount = existingImages.filter(img => !deleteImageIds.includes(img.id)).length
  const totalImageCount = remainingExistingCount + newImages.length

  /**
   * レビュー削除処理のハンドラ
   */
  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteReview(review.id)
      if (result.success) {
        router.refresh()
      }
    })
  }

  /**
   * 編集モード開始のハンドラ
   */
  const handleEdit = () => {
    setIsEditing(true)
    setEditRating(review.rating)
    setEditContent(review.content || '')
    setEditError(null)
    setExistingImages(review.images)
    setDeleteImageIds([])
    setNewImages([])
  }

  /**
   * 編集キャンセルのハンドラ
   */
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditError(null)
    setDeleteImageIds([])
    setNewImages([])
  }

  /**
   * 画像アップロードのハンドラ
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (totalImageCount >= MAX_REVIEW_IMAGES) {
      setEditError(`画像は${MAX_REVIEW_IMAGES}枚までです`)
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setEditError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      e.target.value = ''
      return
    }

    setUploading(true)
    setEditError(null)

    try {
      const compressedFile = await prepareFileForUpload(file, {
        maxSizeMB: DEFAULT_COMPRESSION_MAX_SIZE_MB,
        maxWidthOrHeight: MAX_IMAGE_DIMENSION,
      })
      const formData = new FormData()
      formData.append('file', compressedFile)

      const result = await new Promise<{ url?: string; error?: string }>((resolve) => {
        const xhr = new XMLHttpRequest()

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve(response)
            } catch {
              resolve({ error: 'アップロードに失敗しました' })
            }
          } else {
            resolve({ error: 'アップロードに失敗しました' })
          }
        })

        xhr.addEventListener('error', () => {
          resolve({ error: 'アップロードに失敗しました' })
        })

        xhr.open('POST', '/api/upload')
        xhr.send(formData)
      })

      if (result.error) {
        setEditError(result.error ?? MSG_ERROR_FALLBACK)
      } else if (result.url) {
        setNewImages([...newImages, result.url])
      }
    } catch {
      setEditError('アップロードに失敗しました')
    }

    setUploading(false)
    e.target.value = ''
  }

  /**
   * 編集内容保存のハンドラ
   */
  const handleSaveEdit = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('rating', editRating.toString())
      formData.append('content', editContent)
      deleteImageIds.forEach(id => formData.append('deleteImageIds', id))
      newImages.forEach(url => formData.append('imageUrls', url))

      const result = await updateReview(review.id, formData)
      if (!result.success) {
        setEditError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      } else {
        setIsEditing(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="p-4 border-b last:border-b-0" data-testid="review-card">
      {isEditing ? (
        <ReviewEditForm
          editRating={editRating}
          onRatingChange={setEditRating}
          editContent={editContent}
          onContentChange={setEditContent}
          existingImages={existingImages}
          deleteImageIds={deleteImageIds}
          onDeleteExistingImage={(id) => setDeleteImageIds([...deleteImageIds, id])}
          onRestoreExistingImage={(id) => setDeleteImageIds(deleteImageIds.filter(i => i !== id))}
          newImages={newImages}
          onRemoveNewImage={(index) => setNewImages(newImages.filter((_, i) => i !== index))}
          totalImageCount={totalImageCount}
          uploading={uploading}
          onImageUpload={handleImageUpload}
          editError={editError}
          isPending={isPending}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      ) : (
        <ReviewDisplay
          review={review}
          isOwner={isOwner}
          currentUserId={currentUserId}
          showDeleteConfirm={showDeleteConfirm}
          isPending={isPending}
          onEdit={handleEdit}
          onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
          onCancelDelete={() => setShowDeleteConfirm(false)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
