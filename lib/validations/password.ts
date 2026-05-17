/**
 * パスワードバリデーション
 *
 * @module lib/validations/password
 */

import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants/limits'

export { PASSWORD_MIN_LENGTH }

/**
 * エラーメッセージ
 */
export const PASSWORD_ERRORS = {
  MIN_LENGTH: `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`,
  REQUIRE_LETTER: 'パスワードはアルファベットを含めてください',
  REQUIRE_NUMBER: 'パスワードは数字を含めてください',
  REQUIRE_BOTH: 'パスワードはアルファベットと数字を両方含めてください',
} as const

/**
 * パスワードバリデーションスキーマ
 *
 * Zodを使用したパスワードのバリデーションスキーマ。
 * 以下の要件を検証します:
 * - 8文字以上
 * - アルファベットを1文字以上含む
 * - 数字を1文字以上含む
 *
 * @example
 * ```typescript
 * const result = passwordSchema.safeParse('MyPassword123')
 * if (result.success) {
 *   console.log('Valid password:', result.data)
 * } else {
 *   console.log('Errors:', result.error.errors)
 * }
 * ```
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_ERRORS.MIN_LENGTH)
  .regex(/[a-zA-Z]/, PASSWORD_ERRORS.REQUIRE_LETTER)
  .regex(/[0-9]/, PASSWORD_ERRORS.REQUIRE_NUMBER)

/**
 * パスワードバリデーション結果の型
 */
export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; error: string }

/**
 * パスワードを検証する
 *
 * パスワードが要件を満たしているかチェックし、
 * 結果とエラーメッセージを返します。
 *
 * ## パスワード要件
 * - 8文字以上
 * - アルファベット（a-z, A-Z）を1文字以上含む
 * - 数字（0-9）を1文字以上含む
 *
 * @param password - 検証するパスワード
 * @returns バリデーション結果
 *
 * @example
 * ```typescript
 * const result = validatePassword('abc12345')
 * if (result.valid) {
 *   // パスワードは有効
 * } else {
 *   console.log(result.error) // エラーメッセージ
 * }
 * ```
 */
export function validatePassword(password: string): PasswordValidationResult {
  // 長さチェック
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: PASSWORD_ERRORS.MIN_LENGTH }
  }

  // アルファベットチェック
  const hasLetter = /[a-zA-Z]/.test(password)
  // 数字チェック
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

/**
 * パスワードが有効かどうかをチェックする（簡易版）
 *
 * @param password - 検証するパスワード
 * @returns パスワードが有効な場合はtrue
 *
 * @example
 * ```typescript
 * if (isValidPassword('MyPassword123')) {
 *   // パスワードは有効
 * }
 * ```
 */
export function isValidPassword(password: string): boolean {
  return validatePassword(password).valid
}
