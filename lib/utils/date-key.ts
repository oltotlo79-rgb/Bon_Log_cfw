/**
 * @module lib/utils/date-key
 */

/** Date を YYYY-MM-DD 形式に正規化する。toISOString は必ず 'T' を含むので slice(0, 10) は string で確定する。 */
export function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
