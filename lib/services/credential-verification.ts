/**
 * @module lib/services/credential-verification
 *
 * メール + パスワード認証のコアロジック（services 層）。
 *
 * lib/auth.ts の authorize() と モバイル API の /api/v1/auth/login の双方から共有する。
 * 認証・認可は各呼び出し元が担う（ゲスト判定・2FA 強制はこのモジュールでは行わない）。
 *
 * 戻り値の種別:
 *   - ok:true — 照合成功、user の主要フィールドを返す
 *   - ok:false, reason:'throttled' — ロックアウト中（ブルートフォース）
 *   - ok:false, reason:'invalid' — 汎用失敗（ユーザー不在/パスワード不一致/未確認/停止）
 *   - ok:false, reason:'suspended' — アカウント停止
 *   - ok:false, reason:'unverified' — メール未確認
 *   - ok:false, reason:'no_password' — OAuth 専用アカウント（パスワード未設定）
 *
 * Why 細粒度の reason: モバイル API は HTTP ステータスで詳細を返す必要があるため、
 * Web の authorize() が null で統一するのとは異なり reason を分ける。
 * Web 側では reason を参照せず null 相当として扱うことで既存挙動を維持する。
 */

import 'server-only'

// bcryptjs: C++ ネイティブバインディング不要で CI / Edge Runtime と互換性があるため採用
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import {
  checkLoginThrottleForRequest,
  recordLoginFailureForRequest,
  resetLoginThrottleForRequest,
} from '@/lib/services/login-throttle'

export interface VerifiedUser {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  twoFactorEnabled: boolean
}

export type CredentialVerifyResult =
  | { ok: true; user: VerifiedUser }
  | { ok: false; reason: 'throttled' | 'invalid' | 'suspended' | 'unverified' | 'no_password' }

/**
 * メール + パスワードを照合し、成功なら VerifiedUser を返す。
 *
 * 失敗時のログイン失敗記録と成功時のリセットはこの関数内で行う（呼び出し元への責務分散を防ぐ）。
 * ゲスト共有アカウントの処理・2FA 強制は含まない（呼び出し元が担う）。
 *
 * @param email - 正規化済み（lowercase + trim）のメールアドレス
 * @param password - 平文パスワード（ここで bcrypt.compare する）
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<CredentialVerifyResult> {
  // 1. ブルートフォース対策チェック（ロックアウト中なら即拒否）
  const throttle = await checkLoginThrottleForRequest(email)
  if (!throttle.allowed) {
    return { ok: false, reason: 'throttled' }
  }

  // 2. ユーザー取得
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
      nickname: true,
      avatarUrl: true,
      isSuspended: true,
      emailVerified: true,
      twoFactorEnabled: true,
    },
  })

  // OAuth 専用アカウント（password == null）は早期判定が必要だが、
  // 列挙攻撃対策のため失敗記録はせず 'no_password' reason で分岐させる。
  // 呼び出し元（モバイル）は 'invalid' と同一の 401 を返すこと。
  if (!user || !user.password) {
    if (user) {
      // ユーザーは存在するが password なし（OAuth 専用）
      await recordLoginFailureForRequest(email)
      return { ok: false, reason: 'no_password' }
    }
    await recordLoginFailureForRequest(email)
    return { ok: false, reason: 'invalid' }
  }

  if (!user.emailVerified) {
    await recordLoginFailureForRequest(email)
    return { ok: false, reason: 'unverified' }
  }

  if (user.isSuspended) {
    await recordLoginFailureForRequest(email)
    return { ok: false, reason: 'suspended' }
  }

  // 3. bcrypt 照合
  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    await recordLoginFailureForRequest(email)
    return { ok: false, reason: 'invalid' }
  }

  // 4. 成功: 失敗カウンタをリセット
  await resetLoginThrottleForRequest(email)

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  }
}
