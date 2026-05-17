'use client'

import { useState, useRef, useEffect } from 'react'
import { prepareFileForUpload, isVideoFile, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, uploadVideoToR2 } from '@/lib/client-image-compression'
import { DEFAULT_COMPRESSION_MAX_SIZE_MB, MAX_IMAGE_DIMENSION } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * メディアファイルの型
 */
export type MediaFile = {
  url: string
  type: string
}

/**
 * ファイルを XHR でアップロードするスタンドアロン関数
 *
 * React の状態管理に依存しないため、フックの外からでも使用可能。
 * ReviewForm や ReviewCard など、フル useMediaUpload フックが不要なケースで使用する。
 */
export function uploadFileViaXhr(
  file: File,
  options?: { onProgress?: (progress: number) => void }
): Promise<{ url?: string; type?: string; error?: string }> {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()

    if (options?.onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          options.onProgress!(progress)
        }
      })
    }

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
}

/**
 * 画像圧縮フック
 *
 * クライアントサイドで画像を圧縮してアップロード用ファイルを返す。
 */
export function useImageCompression() {
  /**
   * 画像ファイルを圧縮してアップロード用 File を返す。
   * 圧縮中は onProgress コールバックで状態を通知する。
   */
  async function compressImage(
    file: File,
    onProgress: (message: string | null) => void
  ): Promise<File> {
    onProgress('画像を圧縮中...')
    const compressed = await prepareFileForUpload(file, {
      maxSizeMB: DEFAULT_COMPRESSION_MAX_SIZE_MB,
      maxWidthOrHeight: MAX_IMAGE_DIMENSION,
    })
    onProgress(null)
    return compressed
  }

  return { compressImage }
}

/**
 * XHRアップロードフック
 *
 * FormData を XHR で送信し、進捗とキャンセルをサポートする。
 */
export function useMediaXhrUpload(
  setUploadProgress: (progress: number) => void,
  abortControllerRef: React.MutableRefObject<AbortController | null>
) {
  /**
   * 画像ファイルを XHR でアップロードする。
   * 進捗はコールバックで通知する。
   */
  async function uploadImageViaXhr(
    file: File
  ): Promise<{ url?: string; type?: string; error?: string }> {
    const formData = new FormData()
    formData.append('file', file)

    return new Promise<{ url?: string; type?: string; error?: string }>((resolve) => {
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

      xhr.addEventListener('abort', () => {
        resolve({ error: 'アップロードがキャンセルされました' })
      })

      abortControllerRef.current?.signal.addEventListener('abort', () => {
        xhr.abort?.()
      })

      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    })
  }

  return { uploadImageViaXhr }
}

/**
 * useMediaUpload フックのパラメータ
 */
type UseMediaUploadParams = {
  maxImages: number
  maxVideos: number
  onError: (message: string | null) => void
}

/**
 * メディアアップロードのカスタムフック
 *
 * ファイル選択、XHRアップロード（進捗追跡付き）、AbortControllerによるキャンセル機能を提供。
 * useImageCompression と useMediaXhrUpload を合成して使用する。
 */
export function useMediaUpload({ maxImages, maxVideos, onError }: UseMediaUploadParams) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { compressImage } = useImageCompression()
  const { uploadImageViaXhr } = useMediaXhrUpload(setUploadProgress, abortControllerRef)

  /**
   * コンポーネントアンマウント時にアップロードをキャンセル
   */
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  /**
   * ファイル選択時のハンドラ
   *
   * ## 処理フロー
   * 1. ファイルの種類（画像/動画）を判定
   * 2. 現在の添付数と上限をチェック
   * 3. 動画の場合はR2に直接アップロード（Vercel制限回避）
   * 4. 画像の場合はクライアントサイドで圧縮してアップロード
   * 5. 成功時にmediaFiles配列に追加
   * 6. キャンセル時は処理を中断
   */
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    for (const file of selectedFiles) {
      const isVideo = isVideoFile(file)

      const currentImageCount = mediaFiles.filter(m => m.type === 'image').length
      const currentVideoCount = mediaFiles.filter(m => m.type === 'video').length

      if (!isVideo && currentImageCount >= maxImages) {
        onError(`画像は${maxImages}枚まで添付できます`)
        break
      }

      if (isVideo && currentVideoCount >= maxVideos) {
        onError(`動画は${maxVideos}本まで添付できます`)
        break
      }

      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        onError(`動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
        continue
      }

      if (!isVideo && file.size > MAX_IMAGE_SIZE) {
        onError(`画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`)
        continue
      }

      setUploading(true)
      setUploadProgress(0)
      onError(null)

      abortControllerRef.current = new AbortController()

      try {
        if (isVideo) {
          const result = await uploadVideoToR2(file, 'posts', (progress) => {
            setUploadProgress(progress)
          })

          if (abortControllerRef.current?.signal.aborted) return

          if ('error' in result && result.error) {
            onError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
          } else if (result.url) {
            setMediaFiles(prev => [...prev, { url: result.url!, type: 'video' }])
          }
        } else {
          const fileToUpload = await compressImage(file, onError)
          const result = await uploadImageViaXhr(fileToUpload)

          if (abortControllerRef.current?.signal.aborted) return

          if (result.error) {
            onError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
          } else if (result.url) {
            setMediaFiles(prev => [...prev, { url: result.url!, type: result.type || 'image' }])
          }
        }
      } catch {
        if (!abortControllerRef.current?.signal.aborted) {
          onError('アップロードに失敗しました')
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setUploading(false)
          setUploadProgress(0)
        }
        abortControllerRef.current = null
      }
    } // end for

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * メディアを削除するハンドラ
   */
  function removeMedia(index: number) {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
  }

  return {
    mediaFiles,
    setMediaFiles,
    uploading,
    setUploading,
    uploadProgress,
    setUploadProgress,
    handleFileSelect,
    removeMedia,
    abortControllerRef,
    fileInputRef,
  }
}
