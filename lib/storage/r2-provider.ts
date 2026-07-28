/**
 * @module lib/storage/r2-provider
 *
 * Cloudflare R2 (S3 互換) のストレージ実装。エンドポイントは Account ID で導出するため
 * SDK を変えずに AWS S3 SDK 流のフローを流用できる。必要な環境変数:
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME /
 *   R2_PUBLIC_URL (省略時は `{bucket}.{account}.r2.dev` を組み立てる)。
 */

import crypto from 'crypto'
import logger from '@/lib/logger'
import type { StorageProvider, UploadResult, DeleteResult } from './types'
import { getStorageErrorMessage, getExtension } from './helpers'
import { STORAGE_RANDOM_BYTES } from '@/lib/constants/limits'

export class CloudflareR2StorageProvider implements StorageProvider {
  private bucket: string
  private publicUrl: string

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || 'uploads'
    this.publicUrl = process.env.R2_PUBLIC_URL || ''
    logger.log('Storage provider initialized: r2')
  }

  private getConfig() {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 credentials not configured')
    }
    return {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      accessKeyId,
      secretAccessKey,
      bucket: this.bucket,
    }
  }

  async upload(file: Buffer, _filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const ext = getExtension(contentType)
      const key = `${folder}/${Date.now()}-${crypto.randomBytes(STORAGE_RANDOM_BYTES).toString('hex')}${ext}`

      await putObject(this.getConfig(), key, file, contentType)

      const url = this.publicUrl
        ? `${this.publicUrl}/${key}`
        : `https://${this.bucket}.${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`
      logger.log('R2 upload success:', url)
      return { success: true, url }
    } catch (err) {
      logger.error('R2 upload error:', err)
      return { success: false, error: getStorageErrorMessage(err, 'アップロードに失敗しました') }
    }
  }

  async delete(url: string): Promise<DeleteResult> {
    try {
      const { deleteObject } = await import('@/lib/storage/s3-sign')
      const urlObj = new URL(url)
      const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname

      await deleteObject(this.getConfig(), key)
      logger.log('R2 delete success:', url)
      return { success: true }
    } catch (err) {
      // S3 互換 DELETE は本来キー不在でも 204 を返す仕様だが、実装差異に備えて
      // 404 応答も idempotent success として扱う（呼び出し側の outbox worker が誤って
      // リトライし続けないようにするため）。
      if (err instanceof Error && /R2 DELETE failed: 404/.test(err.message)) {
        logger.log('R2 delete: object already absent (idempotent success):', url)
        return { success: true, notFound: true }
      }
      logger.error('R2 delete error:', err)
      return { success: false, error: getStorageErrorMessage(err, '削除に失敗しました') }
    }
  }
}
