/**
 * 指定された ID 順序を維持しつつ、取得済み配列から該当アイテムを抽出する。
 *
 * Prisma の findMany は `IN` 句の順序を保証しないため、全文検索のスコア順など
 * 外部で決まった並びを維持したい場合に使う。`.find()` の O(n²) を Map による O(n) に改善。
 */
export function preserveOrder<T extends { id: string }>(ids: string[], items: T[]): T[] {
  const map = new Map(items.map((item) => [item.id, item]))
  return ids.map((id) => map.get(id)).filter((item): item is T => item !== undefined)
}
