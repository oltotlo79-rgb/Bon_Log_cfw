import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BonsaiCareType } from '@prisma/client'

import {
  BonsaiCalendarMultiMonthGrid,
  isMultiMonthMode,
} from '@/components/bonsai/calendar/BonsaiCalendarMultiMonthGrid'
import {
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_MONTH,
  CALENDAR_MODE_YEAR,
} from '@/lib/constants/bonsai-care'
import type { CareLogListItem } from '@/types/bonsai-care'

describe('BonsaiCalendarMultiMonthGrid', () => {
  it('isMultiMonthMode は month を false、それ以外は true', () => {
    expect(isMultiMonthMode(CALENDAR_MODE_MONTH)).toBe(false)
    expect(isMultiMonthMode(CALENDAR_MODE_HALF_YEAR)).toBe(true)
    expect(isMultiMonthMode(CALENDAR_MODE_YEAR)).toBe(true)
  })

  it('half-year モードで列ヘッダが 6 個', () => {
    render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_HALF_YEAR}
        anchor={new Date(2026, 3, 1)}
        logs={[]}
        records={[]}
        posts={[]}
        onSelectDate={() => {}}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(6)
  })

  it('year モードで列ヘッダが 12 個', () => {
    render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_YEAR}
        anchor={new Date(2026, 3, 1)}
        logs={[]}
        records={[]}
        posts={[]}
        onSelectDate={() => {}}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(12)
  })

  it('行ヘッダ（日ラベル）は 31 個 + 列ヘッダ用ラベル 1 個 = 32 個', () => {
    render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_HALF_YEAR}
        anchor={new Date(2026, 3, 1)}
        logs={[]}
        records={[]}
        posts={[]}
        onSelectDate={() => {}}
      />,
    )
    const rowheaders = screen.getAllByRole('rowheader')
    expect(rowheaders).toHaveLength(32)
  })

  it('存在しない日（2025-02-29）は aria-hidden で gridcell ではない', () => {
    render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_HALF_YEAR}
        anchor={new Date(2025, 6, 1)} // 2025-02 を含む 2025-08 anchor は範囲外、代わりに 2025-07 anchor で
        logs={[]}
        records={[]}
        posts={[]}
        onSelectDate={() => {}}
      />,
    )
    // 2025-02 を含めるには anchor=2025-07
    // 2025-02-29 は存在しないので gridcell に含まれない
    const cells = screen.getAllByRole('gridcell')
    const has2025Feb29 = cells.some(
      (c) => c.getAttribute('aria-label')?.includes('2025年2月29日'),
    )
    expect(has2025Feb29).toBe(false)
  })

  it('年月の列ヘッダが古い順 → 新しい順で並ぶ', () => {
    render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_HALF_YEAR}
        anchor={new Date(2026, 3, 1)}
        logs={[]}
        records={[]}
        posts={[]}
        onSelectDate={() => {}}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    // 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04
    expect(headers[0]!.textContent).toContain('2025年11月')
    expect(headers[5]!.textContent).toContain('2026年4月')
  })

  it('クリックで onSelectDate が呼ばれる', () => {
    const onSelectDate = vi.fn()
    render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_HALF_YEAR}
        anchor={new Date(2026, 3, 1)}
        logs={[]}
        records={[]}
        posts={[]}
        onSelectDate={onSelectDate}
      />,
    )
    const cells = screen.getAllByRole('gridcell')
    fireEvent.click(cells[10]!)
    expect(onSelectDate).toHaveBeenCalledTimes(1)
  })

  it('overflow-x-auto クラスを持つ（モバイル横スクロール）', () => {
    const { container } = render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_YEAR}
        anchor={new Date(2026, 3, 1)}
        logs={[]}
        records={[]}
        posts={[]}
        onSelectDate={() => {}}
      />,
    )
    const grid = container.querySelector('[role="grid"]')
    expect(grid?.className).toContain('overflow-x-auto')
  })

  it('該当月のログがセルにマッピングされる', () => {
    const logs: CareLogListItem[] = [
      {
        id: 'a',
        type: BonsaiCareType.pesticide,
        performedAt: new Date(2026, 3, 15, 10, 0),
        note: null,
      },
    ]
    render(
      <BonsaiCalendarMultiMonthGrid
        mode={CALENDAR_MODE_HALF_YEAR}
        anchor={new Date(2026, 3, 1)}
        logs={logs}
        records={[]}
        posts={[]}
        onSelectDate={() => {}}
      />,
    )
    const cells = screen.getAllByRole('gridcell')
    const matched = cells.find((c) => c.getAttribute('aria-label')?.includes('2026年4月15日'))
    expect(matched?.getAttribute('aria-label')).toContain('消毒')
  })
})
