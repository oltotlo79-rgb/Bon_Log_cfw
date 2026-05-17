/**
 * メディアアップロード用カスタムフック
 *
 * @module hooks/use-media-upload
 */

'use client'

import { useState, useCallback } from 'react'
import { prepareFileForUpload, isVideoFile, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, uploadVideoToR2 } from '@/lib/client-image-compression'

/**
 * useMediaUploadフックのオプション
 *
 * @property maxImages - 添付可能な画像の最大枚数
 * @property maxVideos - 添付可能な動画の最大本数
 * @property currentImageCount - 現在の画像添付数
 * @property currentVideoCount - 現在の動画添付数
 * @property videoUploadPath - 動画アップロード先のパス（例: 'posts', 'comments'）
 * @property onUploadComplete - アップロード完了時のコールバック
 * @property onError - エラー発生時のコールバック
 */
interface UseMediaUploadOptions {
  maxImages: number
  maxVideos: number
  currentImageCount: number
  currentVideoCount: number
  videoUploadPath?: string
  onUploadComplete: (result: { url: string; type: string }) => void
  onError: (error: string) => void
}

/**
 * useMediaUploadフックの戻り値
 *
 * @property uploading - アップロード中かどうか
 * @property uploadProgress - アップロード進捗（0-100%）
 * @property uploadFile - ファイルをアップロードする関数
 */
interface UseMediaUploadReturn {
  uploading: boolean
  uploadProgress: number
  uploadFile: (file: File) => Promise<void>
}

/**
 * メディアアップロード用カスタムフック
 *
 * 画像・動画ファイルのアップロードを行うための共通ロジックを提供します。
 *
 * ## 処理フロー
 * 1. ファイルの種類（画像/動画）を判定
 * 2. 添付数・ファイルサイズの上限をチェック
 * 3. 動画の場合はR2に直接アップロード
 * 4. 画像の場合はクライアントサイドで圧縮してXHRアップロード
 * 5. 完了/エラー時にコールバックを呼び出し
 *
 * @param options - フックのオプション
 * @returns アップロード状態と関数
 *
 * @example
 * ```tsx
 * const { uploading, uploadProgress, uploadFile } = useMediaUpload({
 *   maxImages: 4,
 *   maxVideos: 1,
 *   currentImageCount: mediaFiles.filter(m => m.type === 'image').length,
 *   currentVideoCount: mediaFiles.filter(m => m.type === 'video').length,
 *   videoUploadPath: 'posts',
 *   onUploadComplete: (result) => setMediaFiles(prev => [...prev, result]),
 *   onError: (error) => setError(error),
 * })
 * ```
 */
export function useMediaUpload(options: UseMediaUploadOptions): UseMediaUploadReturn {
  const {
    maxImages,
    maxVideos,
    currentImageCount,
    currentVideoCount,
    videoUploadPath = 'posts',
    onUploadComplete,
    onError,
  } = options

  /**
   * アップロード中のローディング状態
   */
  const [uploading, setUploading] = useState(false)

  /**
   * アップロード進捗（0-100%）
   */
  const [uploadProgress, setUploadProgress] = useState(0)

  /**
   * ファイルをアップロードする関数
   *
   * @param file - アップロードするファイル
   */
  const uploadFile = useCallback(async (file: File) => {
    const isVideo = isVideoFile(file)

    // 添付数の上限チェック
    if (!isVideo && currentImageCount >= maxImages) {
      onError(`画像は${maxImages}枚まで添付できます`)
      return
    }

    if (isVideo && currentVideoCount >= maxVideos) {
      onError(`動画は${maxVideos}本まで添付できます`)
      return
    }

    // ファイルサイズチェック
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      onError(`動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      return
    }

    if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      onError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      if (isVideo) {
        /**
         * 動画の場合はR2に直接アップロード
         * Vercelの4.5MB制限を回避して256MBまで対応
         */
        const result = await uploadVideoToR2(file, videoUploadPath, (progress) => {
          setUploadProgress(progress)
        })

        if (result.error) {
          onError(result.error)
        } else if (result.url) {
          onUploadComplete({ url: result.url, type: 'video' })
        }
      } else {
        /**
         * 画像の場合はクライアントサイドで圧縮
         * 通信量とストレージコストを削減
         */
        onError('画像を圧縮中...')
        const fileToUpload = await prepareFileForUpload(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
        })
        // 圧縮中メッセージをクリア
        onError('')

        /**
         * FormDataを作成してファイルを追加
         */
        const formData = new FormData()
        formData.append('file', fileToUpload)

        /**
         * XMLHttpRequestを使用して進捗を追跡しながらアップロード
         */
        const result = await new Promise<{ url?: string; type?: string; error?: string }>((resolve) => {
          const xhr = new XMLHttpRequest()

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100)
              setUploadProgress(progress)
            }
          })

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

        /**
         * 結果の処理
         */
        if (result.error) {
          onError(result.error)
        } else if (result.url) {
          onUploadComplete({ url: result.url, type: result.type || 'image' })
        }
      }
    } catch {
      onError('アップロードに失敗しました')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [currentImageCount, currentVideoCount, maxImages, maxVideos, videoUploadPath, onUploadComplete, onError])

  return { uploading, uploadProgress, uploadFile }
}
