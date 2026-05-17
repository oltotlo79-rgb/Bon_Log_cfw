/**
 * 管理者機能のServer Actions（共通）
 *
 * このファイルには、多数の箇所から参照される共通の管理者機能を残しています。
 * 機能別の詳細な実装は以下のファイルに分割されています：
 *
 * - `lib/actions/admin/users.ts`   - ユーザー管理
 * - `lib/actions/admin/posts.ts`   - 投稿管理
 * - `lib/actions/admin/content.ts` - コンテンツ管理（イベント/盆栽園/レビュー）
 * - `lib/actions/admin/stats.ts`   - 統計情報
 * - `lib/actions/admin/logs.ts`    - 管理者ログ
 *
 * @module lib/actions/admin
 */

'use server'

import { requireAdmin } from '@/lib/actions/utils'

/**
 * 現在のユーザーが管理者かどうかを判定
 *
 * ## 用途
 * 管理者ページへのアクセス制御に使用します。
 * ページコンポーネントの冒頭で呼び出し、
 * 管理者でなければリダイレクトします。
 *
 * @returns 管理者の場合はtrue、それ以外はfalse
 *
 * @example
 * ```typescript
 * // 管理者ページのレイアウト
 * export default async function AdminLayout({ children }) {
 *   const admin = await isAdmin()
 *   if (!admin) {
 *     redirect('/login')
 *   }
 *   return <div>{children}</div>
 * }
 * ```
 */
export async function isAdmin() {
  const admin = await requireAdmin()
  return !('error' in admin)
}

/**
 * 管理者情報を取得
 *
 * ## 用途
 * 管理者のロール（役割）を確認するために使用します。
 * 例: スーパー管理者のみが特定の操作を実行できる場合など
 *
 * @returns 管理者情報またはnull
 *
 * @example
 * ```typescript
 * const adminInfo = await getAdminInfo()
 * if (adminInfo?.role === 'super_admin') {
 *   // スーパー管理者のみの処理
 * }
 * ```
 */
export async function getAdminInfo() {
  const admin = await requireAdmin()
  if ('error' in admin) return null

  return { userId: admin.userId, role: admin.role }
}
