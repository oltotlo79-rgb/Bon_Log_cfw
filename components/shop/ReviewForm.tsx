/**
 * @file ReviewForm.tsx
 * @description 盆栽園レビュー投稿フォームコンポーネント
 *
 * 機能概要:
 * - 新規レビューの投稿フォームを提供
 * - 星評価（1〜5）の入力
 * - コメントの入力（任意）
 * - 最大3枚までの画像アップロード
 * - 画像はクライアントサイドで圧縮してからアップロード
 * - 投稿成功時にコールバックを呼び出し
 *
 * 使用例:
 * ```tsx
 * <ReviewForm
 *   shopId="shop-123"
 *   onSuccess={() => setShowForm(false)}
 * />
 * ```
 */
'use client'

// React hooks
// useState: フォームの入力値、エラー、画像リストなどを管理
// useTransition: 送信処理の非同期状態を管理
import { useState, useTransition } from 'react'

// Next.jsのルーターフック
// 送信後のページ更新に使用
import { useRouter } from 'next/navigation'

// Next.jsの画像最適化コンポーネント
// アップロードした画像のプレビュー表示に使用
import Image from 'next/image'

// Server Action - レビュー作成
import { createReview } from '@/lib/actions/review'

// 星評価入力コンポーネント
import { StarRating } from './StarRating'

// クライアントサイド画像圧縮ユーティリティ
import { prepareFileForUpload, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'

import { MAX_REVIEW_IMAGES, DEFAULT_COMPRESSION_MAX_SIZE_MB, MAX_IMAGE_DIMENSION } from '@/lib/constants/limits'

// 共通エラー表示コンポーネント
import { FormError } from '@/components/common/FormError'
import {
  MSG_ERROR_FALLBACK,
  MSG_IMAGE_SIZE_LIMIT,
  MSG_REVIEW_IMAGE_LIMIT,
  MSG_REVIEW_RATING_REQUIRED,
  MSG_UPLOAD_FAILED,
} from '@/lib/constants/messages'

/**
 * lucide-react アイコン
 *
 * Image: 画像追加ボタン用の画像アイコン
 * X: 画像削除ボタン用のバツ印アイコン
 */
import { Image as ImageIcon, X as XIcon } from 'lucide-react'

/**
 * ReviewFormコンポーネントのプロパティ定義
 */
interface ReviewFormProps {
  /** レビュー対象の盆栽園ID */
  shopId: string
  /** 投稿成功時に呼び出されるコールバック関数（任意） */
  onSuccess?: () => void
}

/**
 * レビュー投稿フォームコンポーネント
 *
 * 盆栽園に対するレビューを投稿するためのフォーム。
 * 星評価は必須、コメントと画像は任意。
 * 画像は最大3枚まで添付可能で、アップロード前にクライアントサイドで圧縮される。
 *
 * @param shopId - レビュー対象の盆栽園ID
 * @param onSuccess - 投稿成功時のコールバック
 */
export function ReviewForm({ shopId, onSuccess }: ReviewFormProps) {
  // ルーターインスタンス（送信後のページ更新用）
  const router = useRouter()

  // フォーム送信の非同期処理状態を管理
  const [isPending, startTransition] = useTransition()

  // エラーメッセージの状態
  const [error, setError] = useState<string | null>(null)

  // 星評価の値（0は未選択）
  const [rating, setRating] = useState(0)

  // コメントの内容
  const [content, setContent] = useState('')

  // アップロード済み画像URLの配列
  const [images, setImages] = useState<string[]>([])

  // 画像アップロード中の状態
  const [uploading, setUploading] = useState(false)

  /**
   * 画像アップロードのハンドラ
   * ファイル選択時に呼び出され、圧縮してサーバーにアップロード
   *
   * @param e - ファイル入力の変更イベント
   */
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
    } // end for

    setUploading(false)
    e.target.value = ''
  }

  /**
   * 画像削除のハンドラ
   * 指定されたインデックスの画像を配列から削除
   *
   * @param index - 削除する画像のインデックス
   */
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  /**
   * フォーム送信のハンドラ
   * バリデーションを行い、Server Actionでレビューを作成
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // 評価が未選択の場合はエラー
    if (rating === 0) {
      setError(MSG_REVIEW_RATING_REQUIRED)
      return
    }

    // FormDataを構築
    const formData = new FormData()
    formData.append('shopId', shopId)
    formData.append('rating', rating.toString())
    if (content.trim()) {
      formData.append('content', content.trim())
    }
    // 画像URLを追加
    images.forEach((url) => formData.append('imageUrls', url))

    startTransition(async () => {
      const result = await createReview(formData)

      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      } else {
        // 投稿成功 - フォームをリセット
        setRating(0)
        setContent('')
        setImages([])
        router.refresh() // ページを更新してレビュー一覧を更新
        onSuccess?.() // 成功コールバックを呼び出し
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* エラーメッセージ表示エリア */}
      <FormError message={error} />

      {/* 評価入力（必須） */}
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

      {/* コメント入力（任意） */}
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

      {/* アップロード済み画像のプレビュー */}
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
              {/* 画像削除ボタン */}
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

      {/* 画像追加・送信ボタンエリア */}
      <div className="flex items-center gap-3">
        {/* 画像追加ボタン */}
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

        {/* 画像枚数表示 */}
        <span className="text-xs text-muted-foreground">
          {images.length}/{MAX_REVIEW_IMAGES}枚
        </span>

        {/* スペーサー */}
        <div className="flex-1" />

        {/* 送信ボタン */}
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
