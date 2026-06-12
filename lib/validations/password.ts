/**
 * パスワードバリデーション（client / server 共有の単一ソース）。
 *
 * 文言は `lib/constants/errors/auth` に集約し、RegisterForm / PasswordResetConfirmForm /
 * registerUser / resetPassword すべてが本モジュールの {@link validatePassword} を使うことで
 * 検証ロジックとエラーメッセージの重複を排除する。
 *
 * @module lib/validations/password
 */

import { z } from 'zod'
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/lib/constants/limits'
import {
  ERR_PASSWORD_MIN_LENGTH,
  ERR_PASSWORD_MAX_LENGTH,
  ERR_PASSWORD_ALPHANUMERIC,
  ERR_PASSWORD_REQUIRE_LETTER,
  ERR_PASSWORD_REQUIRE_NUMBER,
} from '@/lib/constants/errors/auth'
import { ERR_INPUT_INVALID_GENERIC } from '@/lib/constants/errors/content'

export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH }

/**
 * パスワード関連のエラーメッセージ。値は `lib/constants/errors/auth` の `ERR_PASSWORD_*` を
 * 参照し、UI 文言を一箇所に寄せる。
 */
export const PASSWORD_ERRORS = {
  MIN_LENGTH: ERR_PASSWORD_MIN_LENGTH,
  MAX_LENGTH: ERR_PASSWORD_MAX_LENGTH,
  REQUIRE_LETTER: ERR_PASSWORD_REQUIRE_LETTER,
  REQUIRE_NUMBER: ERR_PASSWORD_REQUIRE_NUMBER,
  REQUIRE_BOTH: ERR_PASSWORD_ALPHANUMERIC,
} as const

/**
 * パスワードバリデーションスキーマ。
 * 8〜72 文字 + アルファベット 1 文字以上 + 数字 1 文字以上。
 */
// z.string(ERR_INPUT_INVALID_GENERIC) で非文字列（undefined / number 等）が渡った場合の
// invalid_type エラーを日本語化する（Zod v4 のショートハンド構文）。
// min / max / regex の既存メッセージには影響しない。
export const passwordSchema = z
  .string(ERR_INPUT_INVALID_GENERIC)
  .min(PASSWORD_MIN_LENGTH, PASSWORD_ERRORS.MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_ERRORS.MAX_LENGTH)
  .regex(/[a-zA-Z]/, PASSWORD_ERRORS.REQUIRE_LETTER)
  .regex(/[0-9]/, PASSWORD_ERRORS.REQUIRE_NUMBER)

/** パスワードバリデーション結果の型 */
export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; error: string }

/**
 * パスワードを検証する。
 *
 * 要件: {@link PASSWORD_MIN_LENGTH}〜{@link PASSWORD_MAX_LENGTH} 文字、
 * アルファベット（a-z, A-Z）1 文字以上、数字（0-9）1 文字以上。
 *
 * @returns 充足時は `{ valid: true }`、不足時は `{ valid: false, error }`
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: PASSWORD_ERRORS.MIN_LENGTH }
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, error: PASSWORD_ERRORS.MAX_LENGTH }
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  if (!hasLetter && !hasNumber) {
    return { valid: false, error: PASSWORD_ERRORS.REQUIRE_BOTH }
  }
  if (!hasLetter) {
    return { valid: false, error: PASSWORD_ERRORS.REQUIRE_LETTER }
  }
  if (!hasNumber) {
    return { valid: false, error: PASSWORD_ERRORS.REQUIRE_NUMBER }
  }

  return { valid: true }
}

/** パスワードが有効かどうかだけを返す簡易版。 */
export function isValidPassword(password: string): boolean {
  return validatePassword(password).valid
}
