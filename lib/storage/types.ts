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
  /**
   * 削除対象オブジェクトが既に存在しなかった（404 相当）ことを示す。
   * ストレージ削除は idempotent な操作として扱うため、この場合も `success: true` になる。
   * 呼び出し側が「二重削除・再試行で実体が既に無かった」ケースを区別したい場合に参照する。
   */
  notFound?: boolean
}

/**
 * R2 / local など各プロバイダが実装するストレージ契約。
 * `delete` は対象ファイルの公開 URL を受け取る。
 */
export interface StorageProvider {
  upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult>
  delete(url: string): Promise<DeleteResult>
}
