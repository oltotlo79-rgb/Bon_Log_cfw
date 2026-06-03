/**
 * @module app/api/upload/_shared/require-upload-user
 * Upload Route Handler 用の認可ヘルパ。
 *
 * proxy.ts は `/api/*` を Basic 認証から除外するため、upload route の認可責任は
 * handler 内に集約される (.claude/rules/nextjs-api-routes.md)。Server Action 側の
 * 書き込みは `requireActiveNonGuestUser()` で「認証 + 停止 + 非ゲスト」を揃えており、
 * upload route も同じポリシーを共有して、停止ユーザー / ゲストが quota 消費や
 * プロフィール画像更新を迂回できないようにする。
 */

import { NextResponse } from 'next/server'
import { requireActiveNonGuestUser } from '@/lib/actions/utils'
import { ERR_AUTH_REQUIRED } from '@/lib/constants/errors'

export type UploadUserResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * upload route の identity を解決する。認証 + 停止 + 非ゲストを満たせば `userId` を返す。
 * 未認証は 401、停止 / ゲストは 403 を `NextResponse` で返し、呼び出し側はそのまま return する。
 */
export async function requireUploadUser(): Promise<UploadUserResult> {
  const result = await requireActiveNonGuestUser()
  if ('error' in result) {
    // 未認証は 401、停止 / ゲスト (認証済みだが権限なし) は 403 に振り分ける
    const status = result.error === ERR_AUTH_REQUIRED ? 401 : 403
    return { ok: false, response: NextResponse.json({ error: result.error }, { status }) }
  }
  return { ok: true, userId: result.userId }
}
