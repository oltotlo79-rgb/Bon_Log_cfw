/**
 * FormData から型安全に値を取り出すヘルパー。
 *
 * `FormData.get()` の戻り値は `FormDataEntryValue | null`（= `string | File | null`）のため、
 * 文字列として扱うには実行時チェックが必要になる。`as string` キャストだと
 * File が来た場合にサイレントな不正値を生むため、型ガードで絞り込む。
 *
 * @module lib/utils/form-data
 */

/**
 * FormData から文字列値を取り出す。文字列でない（File または null）場合は `null` を返す。
 */
export function getFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  return typeof value === 'string' ? value : null
}

/**
 * FormData から文字列配列を取り出す。File エントリは除外する。
 */
export function getFormStringArray(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === 'string')
}
