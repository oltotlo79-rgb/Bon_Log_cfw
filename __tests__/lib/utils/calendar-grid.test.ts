/**
 * calendar-grid 純粋関数のテスト。
 *
 * 範囲計算・anchor シフト・日付解決・グルーピングの正確性を担保する。
 * うるう年・月末（28/29/30/31）・年跨ぎ・タイムゾーン境界を網羅する。
 */

import { BonsaiCareType } from '@prisma/client'
import {
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_MONTH,
  CALENDAR_MODE_YEAR,
} from '@/lib/constants/bonsai-care'
import {
  formatAnchor,
  groupItemsByDate,
  groupLogsByDate,
  listDisplayMonths,
  localDateKey,
  parseAnchor,
  resolveCalendarRange,
  resolveDateInMonth,
  shiftAnchor,
} from '@/lib/utils/calendar-grid'
import type { CareLogListItem } from '@/types/bonsai-care'

describe('resolveCalendarRange', () => {
  it('1ヶ月モード: anchor 月の初日 〜 翌月初日', () => {
    const anchor = new Date(2026, 3, 15) // 2026-04-15
    const { from, to } = resolveCalendarRange(CALENDAR_MODE_MONTH, anchor)
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(3)
    expect(from.getDate()).toBe(1)
    expect(from.getHours()).toBe(0)
    // to は半開区間: 翌月初日（≒ 2026-05-01 00:00:00.000）
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(4)
    expect(to.getDate()).toBe(1)
    expect(to.getHours()).toBe(0)
  })

  it('6ヶ月モード: 6ヶ月分の範囲を返す', () => {
    const anchor = new Date(2026, 3, 1) // 2026-04
    const { from, to } = resolveCalendarRange(CALENDAR_MODE_HALF_YEAR, anchor)
    expect(from.getFullYear()).toBe(2025)
    expect(from.getMonth()).toBe(10) // 2025-11
    expect(from.getDate()).toBe(1)
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(4) // 2026-05 初日
    expect(to.getDate()).toBe(1)
  })

  it('12ヶ月モード: 12ヶ月分の範囲を返す', () => {
    const anchor = new Date(2026, 3, 1)
    const { from, to } = resolveCalendarRange(CALENDAR_MODE_YEAR, anchor)
    expect(from.getFullYear()).toBe(2025)
    expect(from.getMonth()).toBe(4) // 2025-05
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(4) // 2026-05 初日
  })

  it('年跨ぎ: 2026-01 anchor の 6ヶ月モード = 2025-08〜2026-02 初日', () => {
    const anchor = new Date(2026, 0, 10)
    const { from, to } = resolveCalendarRange(CALENDAR_MODE_HALF_YEAR, anchor)
    expect(from.getFullYear()).toBe(2025)
    expect(from.getMonth()).toBe(7) // 2025-08
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(1) // 2026-02 初日
  })
})

describe('shiftAnchor', () => {
  it('+1 ヶ月: 月初に正規化', () => {
    const r = shiftAnchor(new Date(2026, 3, 15), 1)
    expect(r.getFullYear()).toBe(2026)
    expect(r.getMonth()).toBe(4)
    expect(r.getDate()).toBe(1)
    expect(r.getHours()).toBe(0)
  })

  it('-1 ヶ月: 月初に正規化', () => {
    const r = shiftAnchor(new Date(2026, 3, 15), -1)
    expect(r.getFullYear()).toBe(2026)
    expect(r.getMonth()).toBe(2)
    expect(r.getDate()).toBe(1)
  })

  it('年跨ぎ: 12月 +1 → 翌年 1月', () => {
    const r = shiftAnchor(new Date(2026, 11, 1), 1)
    expect(r.getFullYear()).toBe(2027)
    expect(r.getMonth()).toBe(0)
  })

  it('年跨ぎ: 1月 -1 → 前年 12月', () => {
    const r = shiftAnchor(new Date(2026, 0, 1), -1)
    expect(r.getFullYear()).toBe(2025)
    expect(r.getMonth()).toBe(11)
  })

  it('±0 で同じ月の初日を返す', () => {
    const r = shiftAnchor(new Date(2026, 3, 25), 0)
    expect(r.getMonth()).toBe(3)
    expect(r.getDate()).toBe(1)
  })
})

describe('parseAnchor / formatAnchor', () => {
  it.each([
    ['2026-01', 2026, 0],
    ['2026-12', 2026, 11],
    ['1900-06', 1900, 5],
    ['9999-11', 9999, 10],
  ])('parseAnchor(%s) は妥当な Date を返す', (s, year, monthIdx) => {
    const r = parseAnchor(s)
    expect(r).not.toBeNull()
    expect(r?.getFullYear()).toBe(year)
    expect(r?.getMonth()).toBe(monthIdx)
    expect(r?.getDate()).toBe(1)
    expect(r?.getHours()).toBe(0)
  })

  it.each([
    '2026-00', '2026-13', '2026-1', '26-01', '2026/01', '', 'abc', '2026-01 ',
  ])('parseAnchor(%s) は null を返す', (s) => {
    expect(parseAnchor(s)).toBeNull()
  })

  it('formatAnchor は YYYY-MM 形式で返す', () => {
    expect(formatAnchor(new Date(2026, 3, 15))).toBe('2026-04')
    expect(formatAnchor(new Date(2026, 11, 1))).toBe('2026-12')
    expect(formatAnchor(new Date(2026, 0, 1))).toBe('2026-01')
  })

  it('formatAnchor → parseAnchor で同じ月初に戻る', () => {
    const original = new Date(2026, 3, 1, 0, 0, 0, 0)
    const round = parseAnchor(formatAnchor(original))
    expect(round).toEqual(original)
  })
})

describe('listDisplayMonths', () => {
  it('1ヶ月モード: anchor のみ', () => {
    const months = listDisplayMonths(CALENDAR_MODE_MONTH, new Date(2026, 3, 1))
    expect(months).toHaveLength(1)
    expect(months[0]!.getMonth()).toBe(3)
  })

  it('6ヶ月モード: 古い順 6 個', () => {
    const months = listDisplayMonths(CALENDAR_MODE_HALF_YEAR, new Date(2026, 3, 1))
    expect(months).toHaveLength(6)
    expect(months[0]!.getMonth()).toBe(10) // 2025-11
    expect(months[0]!.getFullYear()).toBe(2025)
    expect(months[5]!.getMonth()).toBe(3) // 2026-04
    expect(months[5]!.getFullYear()).toBe(2026)
  })

  it('12ヶ月モード: 古い順 12 個', () => {
    const months = listDisplayMonths(CALENDAR_MODE_YEAR, new Date(2026, 3, 1))
    expect(months).toHaveLength(12)
    expect(months[0]!.getMonth()).toBe(4) // 2025-05
    expect(months[11]!.getMonth()).toBe(3) // 2026-04
  })

  it('全要素が月初日', () => {
    const months = listDisplayMonths(CALENDAR_MODE_YEAR, new Date(2026, 5, 17))
    for (const m of months) {
      expect(m.getDate()).toBe(1)
      expect(m.getHours()).toBe(0)
    }
  })
})

describe('resolveDateInMonth', () => {
  it('正常系: 2026-04-15', () => {
    const d = resolveDateInMonth(2026, 3, 15)
    expect(d).not.toBeNull()
    expect(d?.getDate()).toBe(15)
  })

  it('うるう年: 2024-02-29 は有効', () => {
    expect(resolveDateInMonth(2024, 1, 29)).not.toBeNull()
  })

  it('非うるう年: 2025-02-29 は null', () => {
    expect(resolveDateInMonth(2025, 1, 29)).toBeNull()
  })

  it('2月30日 は null', () => {
    expect(resolveDateInMonth(2026, 1, 30)).toBeNull()
  })

  it('4月31日 は null', () => {
    expect(resolveDateInMonth(2026, 3, 31)).toBeNull()
  })

  it('11月31日 は null', () => {
    expect(resolveDateInMonth(2026, 10, 31)).toBeNull()
  })

  it.each([
    [2026, -1, 1],
    [2026, 12, 1],
    [2026, 0, 0],
    [2026, 0, 32],
    [2026.5, 0, 1],
    [2026, 0.5, 1],
    [2026, 0, 1.5],
  ])('不正値 (%d, %d, %d) は null', (y, m, d) => {
    expect(resolveDateInMonth(y, m, d)).toBeNull()
  })
})

describe('localDateKey', () => {
  it('YYYY-MM-DD 形式で返す', () => {
    expect(localDateKey(new Date(2026, 3, 15, 10, 30))).toBe('2026-04-15')
    expect(localDateKey(new Date(2026, 11, 1))).toBe('2026-12-01')
    expect(localDateKey(new Date(2026, 0, 1))).toBe('2026-01-01')
  })

  it('時刻部分は無視される', () => {
    expect(localDateKey(new Date(2026, 3, 15, 0, 0))).toBe(
      localDateKey(new Date(2026, 3, 15, 23, 59)),
    )
  })
})

describe('groupLogsByDate', () => {
  const make = (id: string, date: Date, type = BonsaiCareType.pesticide): CareLogListItem => ({
    id,
    type,
    performedAt: date,
    note: null,
  })

  it('空配列は空 Map を返す', () => {
    const r = groupLogsByDate([])
    expect(r.size).toBe(0)
  })

  it('同日のログは同じキーにまとまる', () => {
    const logs = [
      make('a', new Date(2026, 3, 15, 9, 0)),
      make('b', new Date(2026, 3, 15, 14, 0)),
      make('c', new Date(2026, 3, 16, 8, 0)),
    ]
    const r = groupLogsByDate(logs)
    expect(r.size).toBe(2)
    expect(r.get('2026-04-15')).toHaveLength(2)
    expect(r.get('2026-04-16')).toHaveLength(1)
  })

  it('入力の順序を維持する', () => {
    const logs = [
      make('a', new Date(2026, 3, 15, 9, 0)),
      make('b', new Date(2026, 3, 15, 14, 0)),
    ]
    const bucket = groupLogsByDate(logs).get('2026-04-15')
    expect(bucket?.map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('groupItemsByDate', () => {
  it('任意の Date セレクタでグルーピングできる', () => {
    const items = [
      { id: 'r1', recordAt: new Date(2026, 3, 15, 9, 0) },
      { id: 'r2', recordAt: new Date(2026, 3, 15, 14, 0) },
      { id: 'r3', recordAt: new Date(2026, 3, 16, 8, 0) },
    ]
    const r = groupItemsByDate(items, (it) => it.recordAt)
    expect(r.size).toBe(2)
    expect(r.get('2026-04-15')?.map((it) => it.id)).toEqual(['r1', 'r2'])
    expect(r.get('2026-04-16')?.map((it) => it.id)).toEqual(['r3'])
  })

  it('空配列で空 Map', () => {
    const r = groupItemsByDate<{ d: Date }>([], (it) => it.d)
    expect(r.size).toBe(0)
  })
})
