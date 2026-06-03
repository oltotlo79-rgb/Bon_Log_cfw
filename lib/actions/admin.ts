/**
 * @module lib/actions/admin
 *
 * 管理者ページ（Server Component）専用の認可ヘルパー。
 *
 * Why no `'use server'`: これらは admin Server Component からのみ await される。
 * `'use server'` を付けると `isAdmin` が公開 RPC エンドポイントになり攻撃面が増えるため、
 * `server-only` モジュールとして提供する（`lib/actions/utils.ts` と同じ方針）。
 * 機能別の write 系 Server Action は `lib/actions/admin/{users,posts,content,stats,logs}.ts`。
 */

import 'server-only'

import { requireAdmin } from '@/lib/actions/utils'

/**
 * 現在のユーザーが管理者かどうかを判定する。admin ページ冒頭で呼び、false なら redirect する。
 * `requireAdmin()` は JWT を信頼せず毎回 DB を引き直す fresh check のため、権限剥奪が即時反映される。
 */
export async function isAdmin() {
  const admin = await requireAdmin()
  return !('error' in admin)
}

/**
 * 管理者のロール込みで情報を取得する。スーパー管理者限定操作の出し分け等に使う。
 * 管理者でなければ null。
 */
export async function getAdminInfo() {
  const admin = await requireAdmin()
  if ('error' in admin) return null

  return { userId: admin.userId, role: admin.role }
}
