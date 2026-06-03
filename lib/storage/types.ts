/**
 * ストレージ抽象化レイヤー: 共通インターフェース定義
 *
 * @module lib/storage/types
 */

/** 成功時は `url`、失敗時は `error` のみが設定される。 */
export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export interface DeleteResult {
  success: boolean
  error?: string
}

/**
 * R2 / local など各プロバイダが実装するストレージ契約。
 * `delete` は対象ファイルの公開 URL を受け取る。
 */
export interface StorageProvider {
  upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult>
  delete(url: string): Promise<DeleteResult>
}
