import { describe, it, expect } from 'vitest'
import { preserveOrder } from '@/lib/utils/preserve-order'

describe('preserveOrder', () => {
  it('指定された ID の順序で要素を返す', () => {
    const items = [
      { id: 'b', value: 2 },
      { id: 'a', value: 1 },
      { id: 'c', value: 3 },
    ]
    expect(preserveOrder(['a', 'b', 'c'], items)).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ])
  })

  it('items 側に存在しない ID は除外される（undefined をフィルタ）', () => {
    const items = [
      { id: 'a', value: 1 },
      { id: 'c', value: 3 },
    ]
    expect(preserveOrder(['a', 'missing', 'c'], items)).toEqual([
      { id: 'a', value: 1 },
      { id: 'c', value: 3 },
    ])
  })

  it('ids が空配列の場合は空配列を返す', () => {
    expect(preserveOrder([], [{ id: 'a', value: 1 }])).toEqual([])
  })

  it('items が空配列の場合は空配列を返す', () => {
    expect(preserveOrder(['a', 'b'], [])).toEqual([])
  })

  it('同一 ID が ids に複数あれば、その回数分結果に含める', () => {
    const items = [{ id: 'a', value: 1 }]
    expect(preserveOrder(['a', 'a', 'a'], items)).toEqual([
      { id: 'a', value: 1 },
      { id: 'a', value: 1 },
      { id: 'a', value: 1 },
    ])
  })

  it('items に重複 ID がある場合は最後の要素が採用される（Map のセマンティクス）', () => {
    const items = [
      { id: 'a', value: 1 },
      { id: 'a', value: 99 },
    ]
    expect(preserveOrder(['a'], items)).toEqual([{ id: 'a', value: 99 }])
  })

  it('元の items 配列を変更しない（純粋関数）', () => {
    const items = [
      { id: 'b', value: 2 },
      { id: 'a', value: 1 },
    ]
    const snapshot = [...items]
    preserveOrder(['a', 'b'], items)
    expect(items).toEqual(snapshot)
  })

  it('オブジェクトの参照は維持される（コピーされない）', () => {
    const item = { id: 'a', value: 1 }
    const result = preserveOrder(['a'], [item])
    expect(result[0]).toBe(item)
  })

  it('多数の要素でも正しく機能する（O(n) パフォーマンス特性）', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: `id-${i}`, value: i }))
    const reversedIds = items.map((i) => i.id).reverse()
    const result = preserveOrder(reversedIds, items)
    expect(result).toHaveLength(1000)
    expect(result[0]).toEqual({ id: 'id-999', value: 999 })
    expect(result[999]).toEqual({ id: 'id-0', value: 0 })
  })
})
