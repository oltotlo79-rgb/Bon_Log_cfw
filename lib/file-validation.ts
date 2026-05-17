/**
 * ファイルバリデーションユーティリティ
 *
 * ファイルアップロード時のセキュリティ検証を提供
 * MIMEタイプの偽装を防ぐため、ファイルのマジックバイト（シグネチャ）を検証
 *
 * @module lib/file-validation
 */

import { RIFF_HEADER_SIZE, MAX_IMAGE_SIZE } from '@/lib/constants/limits'
import {
  ERR_IMAGE_SIZE_EXCEEDED,
  ERR_INVALID_IMAGE_FORMAT,
  ERR_FILE_FORMAT_NOT_ALLOWED,
  ERR_FILE_FORMAT_UNDETECTABLE_IMAGE,
  ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED,
  ERR_VIDEO_FILE_REQUIRED,
  ERR_FILE_FORMAT_UNDETECTABLE_VIDEO,
  ERR_NOT_VALID_VIDEO,
  ERR_VIDEO_FORMAT_NOT_SUPPORTED,
  ERR_IMAGE_VIDEO_SELECT,
} from '@/lib/constants/errors'

type FileSignature = {
  mimeType: string
  /** ファイル先頭のマジックバイト列（複数候補あり） */
  signatures: number[][]
  /** シグネチャ開始位置（デフォルト 0） */
  offset?: number
}

export type FileValidationResult = {
  valid: boolean
  detectedType?: string
  error?: string
}

/** 対応ファイル形式のマジックバイト定義。複数パターンを持つ形式もある。 */
const FILE_SIGNATURES: FileSignature[] = [
  // JPEG - FFD8FFで始まる
  {
    mimeType: 'image/jpeg',
    signatures: [
      [0xFF, 0xD8, 0xFF, 0xE0], // JFIF
      [0xFF, 0xD8, 0xFF, 0xE1], // EXIF
      [0xFF, 0xD8, 0xFF, 0xE2], // ICC
      [0xFF, 0xD8, 0xFF, 0xE3],
      [0xFF, 0xD8, 0xFF, 0xE8],
      [0xFF, 0xD8, 0xFF, 0xDB], // Raw JPEG
      [0xFF, 0xD8, 0xFF, 0xEE], // Adobe
    ],
  },
  // PNG - 89504E47で始まる
  {
    mimeType: 'image/png',
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  },
  // WebP - RIFFxxxxWEBP
  {
    mimeType: 'image/webp',
    signatures: [[0x52, 0x49, 0x46, 0x46]], // "RIFF" (WEBPは8バイト目以降でチェック)
  },
  // GIF - GIF87a or GIF89a
  {
    mimeType: 'image/gif',
    signatures: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
  },
  // MP4 - ftyp
  {
    mimeType: 'video/mp4',
    signatures: [
      [0x66, 0x74, 0x79, 0x70], // "ftyp" at offset 4
    ],
    offset: 4,
  },
  // QuickTime MOV - ftyp or moov
  {
    mimeType: 'video/quicktime',
    signatures: [
      [0x66, 0x74, 0x79, 0x70], // "ftyp" at offset 4
      [0x6D, 0x6F, 0x6F, 0x76], // "moov" at offset 4
    ],
    offset: 4,
  },
  // WebM - 1A45DFA3
  {
    mimeType: 'video/webm',
    signatures: [[0x1A, 0x45, 0xDF, 0xA3]],
  },
  // AVI - RIFF....AVI
  {
    mimeType: 'video/x-msvideo',
    signatures: [[0x52, 0x49, 0x46, 0x46]], // "RIFF"
  },
]

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
])

/** バイト配列が指定オフセットからシグネチャと一致するか判定する。 */
function matchesSignature(
  buffer: Buffer,
  signature: number[],
  offset: number = 0
): boolean {
  if (buffer.length < offset + signature.length) {
    return false
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false
    }
  }
  return true
}

/** WebP は RIFF コンテナなので 8 バイト目以降に "WEBP" があるかで判別する。 */
function isWebP(buffer: Buffer): boolean {
  if (buffer.length < RIFF_HEADER_SIZE) return false
  // RIFF....WEBP
  return (
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50    // P
  )
}

/** AVI も RIFF コンテナなので 8 バイト目以降に "AVI " があるかで判別する。 */
function isAVI(buffer: Buffer): boolean {
  if (buffer.length < RIFF_HEADER_SIZE) return false
  // RIFF....AVI
  return (
    buffer[8] === 0x41 && // A
    buffer[9] === 0x56 && // V
    buffer[10] === 0x49 && // I
    buffer[11] === 0x20    // (space)
  )
}

/**
 * ファイルのマジックバイトから実 MIME タイプを検出する。
 * 検出できなければ `null`。
 */
export function detectFileType(buffer: Buffer): string | null {
  for (const fileSig of FILE_SIGNATURES) {
    const offset = fileSig.offset || 0

    for (const signature of fileSig.signatures) {
      if (matchesSignature(buffer, signature, offset)) {
        // RIFFコンテナの場合は追加チェック
        if (fileSig.mimeType === 'image/webp') {
          if (isWebP(buffer)) return 'image/webp'
          continue // WebPでなければ次のシグネチャをチェック
        }
        if (fileSig.mimeType === 'video/x-msvideo') {
          if (isAVI(buffer)) return 'video/x-msvideo'
          continue
        }
        return fileSig.mimeType
      }
    }
  }

  return null
}

/**
 * 画像ファイルを検証する。
 * 申告 MIME の許可リスト照合に加え、実ファイルのマジックバイト照合も行う
 * （偽装された Content-Type 対策）。
 */
export function validateImageFile(
  buffer: Buffer,
  claimedMimeType: string,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp']
): FileValidationResult {
  // 1. 主張されたMIMEタイプが許可リストにあるか
  if (!allowedTypes.includes(claimedMimeType)) {
    return {
      valid: false,
      error: ERR_FILE_FORMAT_NOT_ALLOWED(allowedTypes),
    }
  }

  // 2. ファイルシグネチャから実際のタイプを検出
  const detectedType = detectFileType(buffer)

  if (!detectedType) {
    return {
      valid: false,
      error: ERR_FILE_FORMAT_UNDETECTABLE_IMAGE,
    }
  }

  // 3. 検出されたタイプが許可リストにあるか
  if (!allowedTypes.includes(detectedType)) {
    return {
      valid: false,
      error: ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED(detectedType),
    }
  }

  // 4. 主張と検出が一致するか（厳密チェック、省略可能）
  // 注: 一部のケースでは不一致でも問題ない場合がある
  // 例: MOVファイルがvideo/mp4として送信される等

  return {
    valid: true,
    detectedType,
  }
}

/**
 * 動画ファイルを検証する。
 * 申告 MIME の先頭チェック＋マジックバイト照合で偽装を弾く。
 */
export function validateVideoFile(
  buffer: Buffer,
  claimedMimeType: string,
  allowedTypes: string[] = ['video/mp4', 'video/quicktime', 'video/webm']
): FileValidationResult {
  // 1. 主張されたMIMEタイプが動画形式か
  if (!claimedMimeType.startsWith('video/')) {
    return {
      valid: false,
      error: ERR_VIDEO_FILE_REQUIRED,
    }
  }

  // 2. ファイルシグネチャから実際のタイプを検出
  const detectedType = detectFileType(buffer)

  if (!detectedType) {
    return {
      valid: false,
      error: ERR_FILE_FORMAT_UNDETECTABLE_VIDEO,
    }
  }

  // 3. 検出されたタイプが動画形式か
  if (!VIDEO_MIME_TYPES.has(detectedType)) {
    return {
      valid: false,
      error: ERR_NOT_VALID_VIDEO,
    }
  }

  // 4. 検出されたタイプが許可リストにあるか
  if (!allowedTypes.includes(detectedType)) {
    return {
      valid: false,
      error: ERR_VIDEO_FORMAT_NOT_SUPPORTED(detectedType, allowedTypes),
    }
  }

  return {
    valid: true,
    detectedType,
  }
}

/** 申告 MIME から画像 or 動画を判定し、適切な検証関数に委譲する。 */
export function validateMediaFile(
  buffer: Buffer,
  claimedMimeType: string
): FileValidationResult {
  if (claimedMimeType.startsWith('image/')) {
    return validateImageFile(buffer, claimedMimeType)
  }

  if (claimedMimeType.startsWith('video/')) {
    return validateVideoFile(buffer, claimedMimeType)
  }

  return {
    valid: false,
    error: ERR_IMAGE_VIDEO_SELECT,
  }
}

/**
 * パストラバーサル対策として UUID ベースの安全なファイル名を生成する。
 * 拡張子は MIME から決定する（元ファイル名は使用しない）。
 */
export function generateSafeFileName(
  originalName: string,
  mimeType: string
): string {
  // MIMEタイプから拡張子を決定
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-msvideo': 'avi',
  }

  const extension = extensionMap[mimeType] || 'bin'

  // UUIDを生成（crypto.randomUUIDはNode.js 14.17+で利用可能）
  const uuid = crypto.randomUUID()

  return `${uuid}.${extension}`
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * アップロード画像を一括検証する（サイズ → マジックバイト）。
 * 成功時は Buffer を返す。
 */
export async function validateUploadedImage(
  file: File,
  maxSize: number = MAX_IMAGE_SIZE
): Promise<{ valid: true; buffer: Buffer } | { valid: false; error: string }> {
  if (file.size > maxSize) {
    return { valid: false, error: ERR_IMAGE_SIZE_EXCEEDED }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = validateImageFile(buffer, file.type, [...ALLOWED_IMAGE_TYPES])
  if (!result.valid) {
    return { valid: false, error: result.error || ERR_INVALID_IMAGE_FORMAT }
  }
  return { valid: true, buffer }
}
