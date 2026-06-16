/**
 * @module lib/storage/allowed-origins
 *
 * アクティブなストレージプロバイダが生成する公開 URL のプレフィックス集合を返す。
 * v1 の mediaUrls 許可リスト検証に使用する（Web 側は使用しない）。
 *
 * プロバイダ別 URL パターン:
 *   r2    — https://<R2_PUBLIC_URL>/<key>  または  https://<bucket>.<accountId>.r2.dev/<key>
 *   local — /uploads/<folder>/<file> （Next.js 静的配信の相対パス）
 *   supabase — <NEXT_PUBLIC_SUPABASE_URL>/storage/v1/object/public/<bucket>/<path>
 *
 * 環境変数未設定時は空配列を返し、呼び出し元が空配列をどう扱うかは service 層が判断する。
 */

/** アクティブプロバイダが許可する URL プレフィックス。複数の場合（フォールバック）を考慮し配列で返す。 */
export function getAllowedStorageOrigins(): readonly string[] {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  switch (provider) {
    case 'r2': {
      const publicUrl = process.env.R2_PUBLIC_URL
      const accountId = process.env.R2_ACCOUNT_ID
      const bucket = process.env.R2_BUCKET_NAME ?? 'uploads'

      const origins: string[] = []
      if (publicUrl) {
        // カスタムドメイン設定時は R2_PUBLIC_URL を優先する。
        origins.push(publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`)
      }
      if (accountId) {
        // R2_PUBLIC_URL 未設定時のデフォルト形式をフォールバックとして保持する。
        origins.push(`https://${bucket}.${accountId}.r2.dev/`)
      }
      return origins
    }

    case 'supabase': {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads'
      if (!supabaseUrl) return []
      const base = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl
      return [`${base}/storage/v1/object/public/${bucket}/`]
    }

    case 'local':
    default:
      // ローカル開発では Next.js が public/uploads を静的配信する。
      // 相対パス /uploads/ で始まる URL のみ許可する。
      return ['/uploads/']
  }
}
