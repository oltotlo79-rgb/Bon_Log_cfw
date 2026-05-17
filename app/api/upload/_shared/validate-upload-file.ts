/**
 * @module app/api/upload/_shared/validate-upload-file
 * /api/upload と /api/upload/avatar /api/upload/header 共通の file 検証ヘルパ。
 *
 * Why rate-limit より前で検証するか:
 *   不正形状や file 未指定の入力で upload quota / daily counter (R2 課金保護) を
 *   消費しないため、auth → validation → rate-limit の順序を全 upload 経路で統一する。
 *   `lib/actions/post.ts:uploadPostMedia` 等の Server Action と挙動を揃える。
 */

import { NextResponse } from 'next/server'
import {
  ERR_FILE_NOT_SELECTED,
  ERR_IMAGE_SIZE_EXCEEDED,
  ERR_IMAGE_VIDEO_SELECT,
  ERR_INVALID_IMAGE_FORMAT,
  ERR_VIDEO_SIZE_EXCEEDED,
} from '@/lib/constants/errors'
import { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } from '@/lib/constants/limits'
import { validateImageFile, validateVideoFile } from '@/lib/file-validation'

/** 検証成功時に呼び出し側へ渡すデータ。  */
export type ValidatedUploadFile =
  | { kind: 'image'; buffer: Buffer; file: File }
  | { kind: 'video'; buffer: Buffer; file: File }

export type UploadValidationResult =
  | { ok: true; data: ValidatedUploadFile }
  | { ok: false; response: NextResponse }

type ValidateOptions = {
  /** 受け入れる種別。プロフィール画像 (image only) と通常 upload (image + video) で切り替える。 */
  accept: 'image' | 'image+video'
  /**
   * image の MIME 許可リスト。
   * 未指定なら validateImageFile のデフォルト (jpeg/png/webp) を使う。
   */
  allowedImageTypes?: readonly string[]
  /** 動画 MIME 許可リスト。未指定なら validateVideoFile のデフォルトを使う。 */
  allowedVideoTypes?: readonly string[]
  /** image の最大サイズ。未指定なら MAX_IMAGE_SIZE。 */
  maxImageSize?: number
  /** video の最大サイズ。未指定なら MAX_VIDEO_SIZE。 */
  maxVideoSize?: number
}

/**
 * FormData から file を取り出し、type / size / magic byte を検証する。
 * 失敗時は呼び出し側がそのまま return できる `NextResponse` を返し、
 * 成功時は buffer と File を返す。
 *
 * rate-limit / daily-limit はこの関数の呼び出し側で「成功した後」に行うこと。
 */
export async function validateUploadFile(
  request: Request,
  options: ValidateOptions,
): Promise<UploadValidationResult> {
  const formData = await request.formData()
  const rawFile = formData.get('file')

  if (!(rawFile instanceof File)) {
    return error(ERR_FILE_NOT_SELECTED, 400)
  }
  const file = rawFile

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (options.accept === 'image') {
    if (!isImage) {
      return error(ERR_INVALID_IMAGE_FORMAT, 400)
    }
  } else if (!isVideo && !isImage) {
    return error(ERR_IMAGE_VIDEO_SELECT, 400)
  }

  const maxSize = isVideo
    ? (options.maxVideoSize ?? MAX_VIDEO_SIZE)
    : (options.maxImageSize ?? MAX_IMAGE_SIZE)
  if (file.size > maxSize) {
    return error(isVideo ? ERR_VIDEO_SIZE_EXCEEDED : ERR_IMAGE_SIZE_EXCEEDED, 400)
  }

  const allowedImageTypes = options.allowedImageTypes
    ? [...options.allowedImageTypes]
    : undefined
  // image の MIME allowlist が指定されていれば申告 MIME を先にチェック
  if (isImage && allowedImageTypes && !allowedImageTypes.includes(file.type)) {
    return error(ERR_INVALID_IMAGE_FORMAT, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (isImage) {
    const result = allowedImageTypes
      ? validateImageFile(buffer, file.type, allowedImageTypes)
      : validateImageFile(buffer, file.type)
    if (!result.valid) {
      return error(result.error || ERR_INVALID_IMAGE_FORMAT, 400)
    }
    return { ok: true, data: { kind: 'image', buffer, file } }
  }

  // video branch
  const allowedVideoTypes = options.allowedVideoTypes
    ? [...options.allowedVideoTypes]
    : undefined
  const result = allowedVideoTypes
    ? validateVideoFile(buffer, file.type, allowedVideoTypes)
    : validateVideoFile(buffer, file.type)
  if (!result.valid) {
    return error(result.error || ERR_IMAGE_VIDEO_SELECT, 400)
  }
  return { ok: true, data: { kind: 'video', buffer, file } }
}

function error(message: string, status: number): UploadValidationResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) }
}
