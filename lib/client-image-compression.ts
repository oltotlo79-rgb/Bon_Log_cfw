/**
 * クライアントサイド画像圧縮ユーティリティ
 *
 * Canvas APIを使用してブラウザ上で高速に画像を圧縮します。
 * 外部ライブラリ不要で、数十〜数百ミリ秒で処理完了。
 *
 * @module lib/client-image-compression
 */

import { clientLogger } from '@/lib/client-logger'

/**
 * 画像圧縮オプションの型
 */
export interface CompressionOptions {
  /** 最大ファイルサイズ（MB） */
  maxSizeMB?: number
  /** 最大幅または高さ（px） */
  maxWidthOrHeight?: number
  /** JPEG品質（0-1） */
  quality?: number
}

/**
 * 圧縮結果の型
 */
export interface CompressionResult {
  /** 圧縮後のファイル */
  file: File
  /** 元のサイズ（バイト） */
  originalSize: number
  /** 圧縮後のサイズ（バイト） */
  compressedSize: number
  /** 圧縮率（%） */
  compressionRatio: number
}

import {
  MAX_IMAGE_SIZE_BEFORE_COMPRESSION,
  MAX_VIDEO_SIZE,
  SKIP_COMPRESSION_THRESHOLD,
  MAX_IMAGE_DIMENSION,
  DEFAULT_IMAGE_QUALITY,
  COMPRESSION_QUALITY_FACTOR,
  MAX_COMPRESSION_RETRIES,
  DEFAULT_COMPRESSION_MAX_SIZE_MB,
} from '@/lib/constants/limits'

/**
 * デフォルトの圧縮オプション
 */
const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: DEFAULT_COMPRESSION_MAX_SIZE_MB,
  maxWidthOrHeight: MAX_IMAGE_DIMENSION,
  quality: DEFAULT_IMAGE_QUALITY,
}

/**
 * 画像の最大ファイルサイズ（圧縮前）
 * ユーザーがアップロードできる画像の上限
 * @deprecated lib/constants/limits.ts の MAX_IMAGE_SIZE_BEFORE_COMPRESSION を直接使用してください
 */
export const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_BEFORE_COMPRESSION

/**
 * 動画の最大ファイルサイズ（再エクスポート）
 * @deprecated lib/constants/limits.ts の MAX_VIDEO_SIZE を直接使用してください
 */
export { MAX_VIDEO_SIZE }

/**
 * Canvas APIを使用して画像を高速圧縮
 *
 * @param file - 圧縮する画像ファイル
 * @param options - 圧縮オプション
 * @returns 圧縮結果
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = file.size

  // 小さいファイルは圧縮をスキップ
  if (originalSize <= SKIP_COMPRESSION_THRESHOLD) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    }
  }

  try {
    // 画像をロード
    const img = await loadImage(file)

    // リサイズ後のサイズを計算
    const { width, height } = calculateDimensions(
      img.width,
      img.height,
      mergedOptions.maxWidthOrHeight || MAX_IMAGE_DIMENSION
    )

    // Canvasで描画
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas context not available')
    }

    // 高品質なリサイズ設定
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)

    // 目標サイズに収まるまで品質を調整
    const targetSize = (mergedOptions.maxSizeMB || DEFAULT_COMPRESSION_MAX_SIZE_MB) * 1024 * 1024
    let quality = mergedOptions.quality || DEFAULT_IMAGE_QUALITY
    let blob: Blob | null = null

    // 目標サイズに近づけるためリトライ
    for (let i = 0; i < MAX_COMPRESSION_RETRIES; i++) {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
      if (blob.size <= targetSize) {
        break
      }
      quality *= COMPRESSION_QUALITY_FACTOR
    }

    if (!blob) {
      throw new Error('Failed to create blob')
    }

    // FileオブジェクトにJPEG拡張子をつける
    const fileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg'
    const compressedFile = new File([blob], fileName, { type: 'image/jpeg' })
    const compressedSize = compressedFile.size
    const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100)

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio: Math.max(0, compressionRatio),
    }
  } catch (error) {
    clientLogger.error('Image compression failed:', error)
    // 圧縮に失敗した場合は元のファイルを返す
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    }
  }
}

/**
 * 画像ファイルをImageElementとしてロード
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * アスペクト比を維持してリサイズ後のサイズを計算
 */
function calculateDimensions(
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number } {
  if (width <= maxSize && height <= maxSize) {
    return { width, height }
  }

  if (width > height) {
    return {
      width: maxSize,
      height: Math.round((height / width) * maxSize),
    }
  } else {
    return {
      width: Math.round((width / height) * maxSize),
      height: maxSize,
    }
  }
}

/**
 * CanvasをBlobに変換（Promise版）
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      },
      type,
      quality
    )
  })
}

/**
 * 画像ファイルかどうかを判定
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * 動画ファイルかどうかを判定
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * 画像を圧縮してアップロード準備
 */
export async function prepareFileForUpload(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // 動画ファイルは圧縮せずにそのまま返す
  if (isVideoFile(file)) {
    return file
  }

  // 画像ファイルは圧縮
  if (isImageFile(file)) {
    const result = await compressImage(file, options)
    return result.file
  }

  // その他のファイルはそのまま
  return file
}

/**
 * 動画アップロード結果の型
 */
export interface VideoUploadResult {
  url?: string
  error?: string
}

/**
 * 動画をR2に直接アップロード（Presigned URL使用）
 */
export async function uploadVideoToR2(
  file: File,
  folder: string = 'posts',
  onProgress?: (progress: number) => void
): Promise<VideoUploadResult> {
  try {
    // ファイルサイズチェック
    if (file.size > MAX_VIDEO_SIZE) {
      return {
        error: `動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください（現在: ${(file.size / 1024 / 1024).toFixed(1)}MB）`,
      }
    }

    // 1. Presigned URLを取得
    const presignedResponse = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: file.type,
        fileSize: file.size,
        folder,
      }),
    })

    if (!presignedResponse.ok) {
      const errorData = await presignedResponse.json()
      return { error: errorData.error || 'Presigned URLの取得に失敗しました' }
    }

    const { presignedUrl, fileUrl } = await presignedResponse.json()

    // 2. R2に直接アップロード（XMLHttpRequestで進捗追跡）
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: fileUrl })
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

      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  } catch (error) {
    clientLogger.error('Video upload error:', error)
    return { error: 'アップロードに失敗しました' }
  }
}
