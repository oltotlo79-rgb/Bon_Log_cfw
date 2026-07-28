/**
 * @module lib/storage/local-provider
 *
 * 開発用ローカルファイルシステム実装。`public/uploads/<folder>/` 配下に保存して
 * Next.js の静的ファイル配信に乗せる。本番では使わない (スケールしない / デプロイで消える)。
 */

import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import logger from '@/lib/logger'
import type { StorageProvider, UploadResult, DeleteResult } from './types'
import { getStorageErrorMessage, getExtension, isNodeErrnoException } from './helpers'
import { STORAGE_RANDOM_BYTES } from '@/lib/constants/limits'

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads')
    logger.log('Storage provider initialized: local')
    logger.log('Upload directory:', this.uploadDir)
  }

  async upload(file: Buffer, _filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      const folderPath = path.join(this.uploadDir, folder)
      await mkdir(folderPath, { recursive: true })

      // {timestamp}-{16hex}.{ext} で衝突確率を実質ゼロにする。
      const ext = getExtension(contentType)
      const uniqueName = `${Date.now()}-${crypto.randomBytes(STORAGE_RANDOM_BYTES).toString('hex')}${ext}`
      const filePath = path.join(folderPath, uniqueName)

      await writeFile(filePath, file)
      const url = `/uploads/${folder}/${uniqueName}`
      logger.log('Local storage upload success:', url)
      return { success: true, url }
    } catch (err) {
      logger.error('Local storage upload error:', err)
      return { success: false, error: getStorageErrorMessage(err, 'アップロードに失敗しました') }
    }
  }

  async delete(url: string): Promise<DeleteResult> {
    try {
      const relativePath = url.replace('/uploads/', '')
      const filePath = path.resolve(this.uploadDir, relativePath)

      // path traversal 防止: 解決後パスが uploadDir 配下にあることを保証する。
      if (!filePath.startsWith(path.resolve(this.uploadDir))) {
        throw new Error('Invalid file path: path traversal detected')
      }

      await unlink(filePath)
      logger.log('Local storage delete success:', url)
      return { success: true }
    } catch (err) {
      // ファイルが既に存在しない場合は idempotent success として扱う（R2/S3 の DELETE 仕様と合わせる）。
      if (isNodeErrnoException(err) && err.code === 'ENOENT') {
        logger.log('Local storage delete: file already absent (idempotent success):', url)
        return { success: true, notFound: true }
      }
      logger.error('Local storage delete error:', err)
      return { success: false, error: getStorageErrorMessage(err, '削除に失敗しました') }
    }
  }
}
