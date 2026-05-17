/**
 * 予約済みニックネーム（E2Eテスト用など）
 *
 * 一般ユーザーがこれらのユーザー名で新規登録・プロフィール変更を行うと
 * 「このユーザー名は利用できません」と通知される。
 *
 * @module lib/constants/reserved
 */

/** E2Eテスト等で使用するため予約しているニックネーム一覧 */
export const RESERVED_NICKNAMES: readonly string[] = [
  'E2Eテストユーザー',
  'E2E他ユーザー',
  'E2E登録テスト',
  'E2E Test User',
] as const

/** 予約ニックネームの正規化済みセット（前後空白除去・比較用） */
const reservedSet = new Set(
  RESERVED_NICKNAMES.map((n) => n.trim().toLowerCase())
)

/**
 * 指定したニックネームが予約済みかどうかを判定する
 *
 * @param nickname - 判定するニックネーム（前後空白は無視）
 * @returns 予約済みなら true
 */
export function isReservedNickname(nickname: string): boolean {
  if (!nickname || typeof nickname !== 'string') return false
  return reservedSet.has(nickname.trim().toLowerCase())
}
