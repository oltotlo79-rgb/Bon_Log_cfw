/**
 * ストレージ抽象化レイヤー: 共通インターフェース定義
 *
 * @module lib/storage/types
 */

/**
 * アップロード結果の型
 *
 * ## success
 * アップロードが成功したかどうか
 * - true: 成功、url に公開URLが入る
 * - false: 失敗、error にエラーメッセージが入る
 *
 * ## url（オプション）
 * アップロードされたファイルの公開URL
 * 例: https://storage.example.com/uploads/avatars/abc123.jpg
 *
 * ## error（オプション）
 * エラー発生時のメッセージ
 * UI側でユーザーに表示するために使用
 *
 * ## なぜオプショナルか？
 * 成功時は url のみ、失敗時は error のみが設定されるため、
 * どちらもオプショナル（?）としている。
 */
export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * 削除結果の型
 *
 * ## success
 * 削除が成功したかどうか
 *
 * ## error（オプション）
 * エラー発生時のメッセージ
 *
 * アップロード結果より単純（URLは不要なため）
 */
export interface DeleteResult {
  success: boolean
  error?: string
}

/**
 * ストレージプロバイダーのインターフェース
 *
 * ## インターフェースとは？
 * クラスが実装すべきメソッドの「契約」を定義するもの。
 * このインターフェースを実装するクラスは、
 * upload と delete メソッドを必ず持つ必要がある。
 *
 * ## upload メソッド
 * @param file - ファイルのバイナリデータ（Buffer）
 * @param filename - 元のファイル名（参考情報として使用）
 * @param contentType - MIMEタイプ（例: "image/jpeg"）
 * @param folder - 保存先フォルダ（例: "avatars", "posts"）
 *
 * ## delete メソッド
 * @param url - 削除するファイルの公開URL
 *
 * ## 実装クラス
 * - LocalStorageProvider（開発環境）
 * - SupabaseStorageProvider（Supabase）
 * - CloudflareR2StorageProvider（Cloudflare R2）
 */
export interface StorageProvider {
  upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult>
  delete(url: string): Promise<DeleteResult>
}
