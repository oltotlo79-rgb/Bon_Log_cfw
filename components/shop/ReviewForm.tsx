/**
 * @module components/shop/ReviewForm
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createReview } from '@/lib/actions/review'
import { StarRating } from './StarRating'
import { prepareFileForUpload, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'
import { MAX_REVIEW_IMAGES, DEFAULT_COMPRESSION_MAX_SIZE_MB, MAX_IMAGE_DIMENSION } from '@/lib/constants/limits'
import { FormError } from '@/components/common/FormError'
import {
  MSG_ERROR_FALLBACK,
  MSG_IMAGE_SIZE_LIMIT,
  MSG_REVIEW_IMAGE_LIMIT,
  MSG_REVIEW_RATING_REQUIRED,
  MSG_UPLOAD_FAILED,
} from '@/lib/constants/messages'
import { Image as ImageIcon, X as XIcon } from 'lucide-react'

interface ReviewFormProps {
  shopId: string
  onSuccess?: () => void
}

export function ReviewForm({ shopId, onSuccess }: ReviewFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    for (const file of selectedFiles) {
      if (images.length >= MAX_REVIEW_IMAGES) {
        setError(MSG_REVIEW_IMAGE_LIMIT(MAX_REVIEW_IMAGES))
        break
      }

      if (file.size > MAX_IMAGE_SIZE) {
        setError(MSG_IMAGE_SIZE_LIMIT(MAX_IMAGE_SIZE / 1024 / 1024, file.size / 1024 / 1024))
        continue
      }

      setUploading(true)
      setError(null)

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
                resolve({ error: MSG_UPLOAD_FAILED })
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
          setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
        } else if (result.url) {
          setImages(prev => [...prev, result.url!])
        }
      } catch {
        setError(MSG_UPLOAD_FAILED)
      }
    }

    setUploading(false)
    e.target.value = ''
  }

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (rating === 0) {
      setError(MSG_REVIEW_RATING_REQUIRED)
      return
    }

    const formData = new FormData()
    formData.append('shopId', shopId)
    formData.append('rating', rating.toString())
    if (content.trim()) {
      formData.append('content', content.trim())
    }
    images.forEach((url) => formData.append('imageUrls', url))

    startTransition(async () => {
      const result = await createReview(formData)

      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      } else {
        setRating(0)
        setContent('')
        setImages([])
        router.refresh()
        onSuccess?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div className="space-y-2">
        <label className="text-sm font-medium">
          評価 <span className="text-destructive">*</span>
        </label>
        <StarRating
          rating={rating}
          size="lg"
          interactive
          onChange={setRating}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="review-content" className="text-sm font-medium">
          コメント
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="盆栽園の感想を書いてください..."
        />
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((url, index) => (
            <div key={index} className="relative w-20 h-20">
              <Image
                src={url}
                alt={`レビュー画像 ${index + 1}`}
                fill
                className="object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted ${images.length >= MAX_REVIEW_IMAGES || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <ImageIcon className="w-4 h-4" />
          <span className="text-sm">
            {uploading ? 'アップロード中...' : '画像を追加'}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            multiple
            disabled={images.length >= MAX_REVIEW_IMAGES || uploading}
            className="hidden"
          />
        </label>

        <span className="text-xs text-muted-foreground">
          {images.length}/{MAX_REVIEW_IMAGES}枚
        </span>

        <div className="flex-1" />

        <button
          type="submit"
          disabled={isPending || rating === 0}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? '投稿中...' : 'レビューを投稿'}
        </button>
      </div>
    </form>
  )
}
