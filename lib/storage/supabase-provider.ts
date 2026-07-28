/**
 * ストレージ抽象化レイヤー: Supabase Storage 実装
 *
 * @module lib/storage/supabase-provider
 */

import crypto from 'crypto'
import logger from '@/lib/logger'
import type { StorageProvider, UploadResult, DeleteResult } from './types'
import { getStorageErrorMessage, getExtension } from './helpers'
import { STORAGE_RANDOM_BYTES } from '@/lib/constants/limits'

/**
 * Supabase Storage を使用するストレージプロバイダー
 *
 * ## Supabase Storage とは？
 * Supabase が提供するオブジェクトストレージサービス。
 * PostgreSQL データベースと同じプロジェクトで使用でき、
 * 認証（RLS: Row Level Security）との統合が容易。
 *
 * ## 料金体系（参考）
 * - 無料枠: 1GB ストレージ、2GB 転送量/月
 * - Pro: $25/月〜（100GB ストレージ）
 *
 * ## 必要な環境変数
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase プロジェクトURL
 * - SUPABASE_SERVICE_ROLE_KEY: サービスロールキー（サーバーサイド専用）
 * - SUPABASE_STORAGE_BUCKET: バケット名（デフォルト: uploads）
 *
 * ## REST API使用
 * 公式SDKではなくREST APIを直接使用。
 * これによりパッケージサイズを削減し、依存関係を最小化。
 *
 * ## URL形式
 * https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
 */
export class SupabaseStorageProvider implements StorageProvider {
  /**
   * Supabase プロジェクトのURL
   *
   * 形式: https://xxxxx.supabase.co
   */
  private supabaseUrl: string

  /**
   * サービスロールキー
   *
   * 全ての操作が可能な特権キー。
   * サーバーサイドでのみ使用すること！
   * クライアントサイドには絶対に公開しない。
   */
  private supabaseKey: string

  /**
   * ストレージバケット名
   *
   * Supabase Storageの「フォルダ」に相当
   */
  private bucket: string

  /**
   * コンストラクタ
   *
   * 環境変数から認証情報を読み込み。
   * Supabase SDKは使用せず、REST API呼び出しで実装。
   */
  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads'
    logger.log('Storage provider initialized: supabase')
  }

  /**
   * ファイルをSupabase Storageにアップロード
   *
   * ## REST API エンドポイント
   * POST /storage/v1/object/{bucket}/{path}
   *
   * ## 認証
   * Authorization: Bearer {service_role_key}
   *
   * ## 処理フロー
   * 1. 認証情報の確認
   * 2. ユニークなファイル名を生成
   * 3. REST APIでアップロード
   * 4. 公開URLを返す
   */
  async upload(file: Buffer, filename: string, contentType: string, folder: string): Promise<UploadResult> {
    try {
      /**
       * 認証情報のバリデーション
       */
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('Supabase credentials not configured')
      }

      /**
       * ユニークなファイル名を生成
       */
      const ext = getExtension(contentType)
      const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(STORAGE_RANDOM_BYTES).toString('hex')}${ext}`

      /**
       * REST APIでファイルをアップロード
       *
       * fetch(): Web標準のHTTPクライアント
       * - method: 'POST' でファイル作成
       * - headers: 認証情報とContent-Type
       * - body: ファイルデータ（Uint8Arrayに変換）
       *
       * new Uint8Array(file): BufferをUint8Arrayに変換
       * （fetch のbodyとして使用するため）
       */
      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${uniqueName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.supabaseKey}`,
            'Content-Type': contentType,
          },
          body: new Uint8Array(file),
        }
      )

      /**
       * レスポンスの確認
       *
       * response.ok: ステータスコードが200-299の場合true
       */
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Supabase upload failed: ${error}`)
      }

      /**
       * 公開URLを生成
       *
       * Supabaseの公開URLパターン:
       * /storage/v1/object/public/{bucket}/{path}
       *
       * 注意: バケットの公開設定が必要
       */
      const url = `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${uniqueName}`

      logger.log('Supabase storage upload success:', url)
      return { success: true, url }
    } catch (err) {
      logger.error('Supabase storage upload error:', err)
      return { success: false, error: getStorageErrorMessage(err, 'アップロードに失敗しました') }
    }
  }

  /**
   * ファイルをSupabase Storageから削除
   *
   * ## REST API エンドポイント
   * DELETE /storage/v1/object/{bucket}/{path}
   *
   * ## URLからパスを抽出
   * 正規表現で /storage/v1/object/public/{bucket}/{path} からパスを取得
   */
  async delete(url: string): Promise<DeleteResult> {
    try {
      /**
       * 認証情報のバリデーション
       */
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error('Supabase credentials not configured')
      }

      /**
       * URLからパスを取得
       *
       * 正規表現でURLからファイルパスを抽出:
       * /storage/v1/object/public/bucket-name/path/to/file.jpg
       * → pathMatch[1]: "path/to/file.jpg"
       */
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/)
      if (!pathMatch) {
        throw new Error('Invalid Supabase storage URL')
      }
      const filePath = pathMatch[1]

      /**
       * REST APIでファイルを削除
       *
       * DELETE メソッドでファイルを削除
       */
      const response = await fetch(
        `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${filePath}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.supabaseKey}`,
          },
        }
      )

      if (!response.ok) {
        // オブジェクトが既に存在しない場合は idempotent success として扱う
        // （R2/local の delete と同じ扱いに揃え、outbox worker の誤リトライを防ぐ）。
        if (response.status === 404) {
          logger.log('Supabase storage delete: object already absent (idempotent success):', url)
          return { success: true, notFound: true }
        }
        const error = await response.text()
        throw new Error(`Supabase delete failed: ${error}`)
      }

      logger.log('Supabase storage delete success:', url)
      return { success: true }
    } catch (err) {
      logger.error('Supabase storage delete error:', err)
      return { success: false, error: getStorageErrorMessage(err, '削除に失敗しました') }
    }
  }
}
