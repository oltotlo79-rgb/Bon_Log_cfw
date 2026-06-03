'use client'

/**
 * @module components/shop/ReviewCard
 * 表示モードと編集モードを切り替えるオーケストレーター。
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteReview, updateReview } from '@/lib/actions/review'
import { prepareFileForUpload, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'
import { MAX_REVIEW_IMAGES, DEFAULT_COMPRESSION_MAX_SIZE_MB, MAX_IMAGE_DIMENSION } from '@/lib/constants/limits'
import { ReviewDisplay } from './review/ReviewDisplay'
import { ReviewEditForm } from './review/ReviewEditForm'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

interface ReviewCardProps {
  review: {
    id: string
    rating: number
    content: string | null
    createdAt: Date | string
    user: {
      id: string
      nickname: string
      avatarUrl: string | null
    }
    images: { id: string; url: string }[]
  }
  currentUserId?: string
}

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editRating, setEditRating] = useState(review.rating)
  const [editContent, setEditContent] = useState(review.content || '')
  const [editError, setEditError] = useState<string | null>(null)
  const [existingImages, setExistingImages] = useState(review.images)
  const [deleteImageIds, setDeleteImageIds] = useState<string[]>([])
  const [newImages, setNewImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const isOwner = currentUserId === review.user.id

  const remainingExistingCount = existingImages.filter(img => !deleteImageIds.includes(img.id)).length
  const totalImageCount = remainingExistingCount + newImages.length

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteReview(review.id)
      if (result.success) {
        router.refresh()
      }
    })
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditRating(review.rating)
    setEditContent(review.content || '')
    setEditError(null)
    setExistingImages(review.images)
    setDeleteImageIds([])
    setNewImages([])
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditError(null)
    setDeleteImageIds([])
    setNewImages([])
  }

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
