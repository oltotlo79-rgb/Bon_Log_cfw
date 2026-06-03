// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { buildSegmentCountQuery } from '@/lib/services/segment-evaluation'

/** Prisma.Sql のプレースホルダ込み SQL テキストを取得（`.sql` / `.text` どちらでも）。 */
function sqlText(query: { sql?: string; text?: string }): string {
  return query.sql ?? query.text ?? ''
}

describe('buildSegmentCountQuery', () => {
  it('ルール 0 件のときは WHERE なしで全ユーザーを数える', () => {
    const q = buildSegmentCountQuery({ rules: [], logic: 'AND' })
    const text = sqlText(q)
    expect(text).toContain('SELECT COUNT(*)')
    expect(text).toContain('FROM users u')
    expect(text).not.toContain('WHERE')
    expect(q.values).toEqual([])
  })

  it('isPremium=true を boolean パラメータでバインドする', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'isPremium', operator: 'is', value: true }],
      logic: 'AND',
    })
    expect(sqlText(q)).toContain('is_premium =')
    expect(sqlText(q)).toContain('WHERE')
    expect(q.values).toEqual([true])
  })

  it('文字列 "true" も boolean true に正規化する', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'isPremium', operator: 'is', value: 'true' }],
      logic: 'AND',
    })
    expect(q.values).toEqual([true])
  })

  it('isSuspended=false は false にバインドする', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'isSuspended', operator: 'is', value: false }],
      logic: 'AND',
    })
    expect(sqlText(q)).toContain('is_suspended =')
    expect(q.values).toEqual([false])
  })

  it('location contains は前後 % を付けて ILIKE でバインドする', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'location', operator: 'contains', value: '東京' }],
      logic: 'AND',
    })
    expect(sqlText(q)).toContain('ILIKE')
    expect(q.values).toEqual(['%東京%'])
  })

  it('createdAt gte は Date をバインドし >= 演算子を使う', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'createdAt', operator: 'gte', value: '2024-01-01' }],
      logic: 'AND',
    })
    expect(sqlText(q)).toContain('created_at >=')
    expect(q.values).toHaveLength(1)
    expect(q.values[0]).toBeInstanceOf(Date)
  })

  it.each([
    ['gt', '>'],
    ['lt', '<'],
    ['lte', '<='],
    ['eq', '='],
  ])('createdAt %s 演算子が SQL に反映される', (operator, sign) => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'createdAt', operator, value: '2025-03-15' }],
      logic: 'AND',
    })
    expect(sqlText(q)).toContain(`created_at ${sign}`)
  })

  it('不正な日付のルールはスキップされる（WHERE なし）', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'createdAt', operator: 'gte', value: 'not-a-date' }],
      logic: 'AND',
    })
    expect(sqlText(q)).not.toContain('WHERE')
    expect(q.values).toEqual([])
  })

  it('postCount gte は相関サブクエリと数値パラメータで評価する', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'postCount', operator: 'gte', value: 5 }],
      logic: 'AND',
    })
    const text = sqlText(q)
    expect(text).toContain('FROM posts p WHERE p.user_id = u.id')
    expect(text).toContain('>=')
    expect(q.values).toEqual([5])
  })

  it('postCount の文字列値 "5" も数値にして比較する', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'postCount', operator: 'gt', value: '5' }],
      logic: 'AND',
    })
    expect(q.values).toEqual([5])
  })

  it('followerCount は follows サブクエリで評価する', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'followerCount', operator: 'lt', value: 100 }],
      logic: 'AND',
    })
    const text = sqlText(q)
    expect(text).toContain('FROM follows f WHERE f.following_id = u.id')
    expect(text).toContain('<')
    expect(q.values).toEqual([100])
  })

  it('数値化できないカウント値のルールはスキップされる', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'postCount', operator: 'gt', value: 'abc' }],
      logic: 'AND',
    })
    expect(sqlText(q)).not.toContain('WHERE')
    expect(q.values).toEqual([])
  })

  it('未知の field はスキップされる', () => {
    const q = buildSegmentCountQuery({
      rules: [{ field: 'unknownField', operator: 'eq', value: 'x' }],
      logic: 'AND',
    })
    expect(sqlText(q)).not.toContain('WHERE')
    expect(q.values).toEqual([])
  })

  it('AND ロジックは複数条件を AND で結合する', () => {
    const q = buildSegmentCountQuery({
      rules: [
        { field: 'isPremium', operator: 'is', value: true },
        { field: 'postCount', operator: 'gte', value: 3 },
      ],
      logic: 'AND',
    })
    expect(sqlText(q)).toContain(' AND ')
    expect(q.values).toEqual([true, 3])
  })

  it('OR ロジックは複数条件を OR で結合する', () => {
    const q = buildSegmentCountQuery({
      rules: [
        { field: 'isPremium', operator: 'is', value: true },
        { field: 'isSuspended', operator: 'is', value: false },
      ],
      logic: 'OR',
    })
    expect(sqlText(q)).toContain(' OR ')
    expect(q.values).toEqual([true, false])
  })

  it('有効・無効ルールが混在しても有効ルールのみで構築する', () => {
    const q = buildSegmentCountQuery({
      rules: [
        { field: 'unknownField', operator: 'eq', value: 'x' },
        { field: 'isPremium', operator: 'is', value: true },
      ],
      logic: 'AND',
    })
    expect(q.values).toEqual([true])
    expect(sqlText(q)).toContain('WHERE')
  })
})
