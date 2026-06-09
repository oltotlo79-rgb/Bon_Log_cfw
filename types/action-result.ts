/**
 * Server Actions の戻り値用の共通型とヘルパー（単一の定義）
 *
 * 全ての Server Actions はこの形で返却する。
 * 成功: { success: true, data? } / 失敗: { success: false, error } で統一。
 *
 * @example
 * ```ts
 * 'use server'
 * import { z } from 'zod'
 * import { actionSuccess, actionError, type ActionResult } from '@/types/action-result'
 * import { requireActiveNonGuestUser, enforceUserRateLimit } from '@/lib/actions/utils'
 * import { ERR_AUTH_REQUIRED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
 *
 * const updateNameSchema = z.object({ name: z.string().min(1).max(50) })
 *
 * export async function updateName(input: unknown): Promise<ActionResult<{ id: string }>> {
 *   // 1. 認証
 *   const auth = await requireActiveNonGuestUser()
 *   if ('error' in auth) return actionError(auth.error)
 *
 *   // 2. Zod バリデーション
 *   const parsed = updateNameSchema.safeParse(input)
 *   if (!parsed.success) return actionError(ERR_INVALID_INPUT)
 *
 *   // 3. レート制限
 *   const rl = await enforceUserRateLimit(auth.userId, 'update_name')
 *   if (rl) return actionError(rl.error)
 *
 *   await prisma.user.update({ where: { id: auth.userId }, data: { nickname: parsed.data.name } })
 *   return actionSuccess({ id: auth.userId })
 * }
 * ```
 */

/** 成功時: success=true と data（省略可）。失敗時: success=false と error */
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

/** 成功レスポンスを返す */
export function actionSuccess<T>(data?: T): ActionResult<T> {
  return data !== undefined ? { success: true, data } : { success: true }
}

/** エラーレスポンスを返す */
export function actionError(message: string): { success: false; error: string } {
  return { success: false, error: message }
}

// ----------------------------------------------------------------
// コンビネータ
// ----------------------------------------------------------------

/**
 * Server Action 内で頻出する「`{ error: string }` 形式の認可ゲートを通したら続ける」パターンを
 * 1 行に置き換えるコンビネータ。
 *
 * `requireAuth` / `requireAdmin` / `requireActiveNonGuestUser` などが
 * `T | { error: string }` を返すため、毎回 `if ('error' in x) return actionError(x.error)` を
 * 書いていた箇所がこれで消える。
 *
 * @example
 * ```ts
 * export async function createAnnouncement(data: ...) {
 *   return withAuth(requireAdmin('announcements:manage'), async (admin) => {
 *     if (!data.title?.trim()) return actionError(ERR_TITLE_REQUIRED)
 *     // ...admin を使ったビジネスロジック
 *     return actionSuccess()
 *   })
 * }
 * ```
 */
export async function withAuth<T extends object, U>(
  gate: Promise<T | { error: string }> | (T | { error: string }),
  fn: (auth: T) => Promise<ActionResult<U>>,
): Promise<ActionResult<U>> {
  const result = await gate
  if ('error' in result) return actionError(result.error)
  return fn(result)
}

/**
 * 既に得た {@link ActionResult} を別の ActionResult を返す処理にチェインする。
 * 成功時のみ `fn` を実行し、失敗時はそのまま伝播する。
 */
export async function andThenActionResult<T, U>(
  result: ActionResult<T>,
  fn: (value: T | undefined) => Promise<ActionResult<U>>,
): Promise<ActionResult<U>> {
  if (!result.success) return result
  return fn(result.data)
}

/**
 * {@link ActionResult} の成功データを同期的に変換する。失敗時はそのまま伝播。
 */
export function mapActionResult<T, U>(
  result: ActionResult<T>,
  fn: (value: T | undefined) => U,
): ActionResult<U> {
  if (!result.success) return result
  return actionSuccess(fn(result.data))
}
