import { expect } from 'vitest'
import { ActionResult } from '@/types/action-result'

/**
 * ActionResult が成功であることをアサートするヘルパー
 */
export function expectSuccess<T>(result: ActionResult<T>): asserts result is Extract<ActionResult<T>, { success: true }> {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error(`Expected success but got error: ${(result as { success: false; error: string }).error}`)
}

/**
 * ActionResult がエラーであることをアサートするヘルパー
 */
export function expectError<T>(result: ActionResult<T>): asserts result is Extract<ActionResult<T>, { success: false }> {
  expect(result.success).toBe(false)
  if (result.success) throw new Error(`Expected error but got success`)
}
