import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BonsaiCareType } from '@prisma/client'

import { BonsaiCalendarMonthGrid } from '@/components/bonsai/calendar/BonsaiCalendarMonthGrid'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'

describe('BonsaiCalendarMonthGrid', () => {
  it('grid role と曜日ヘッダ 7 つを描画', () => {
    render(<BonsaiCalendarMonthGrid anchor={new Date(2026, 3, 1)} logs={[]} records={[]} posts={[]} onSelectDate={() => {}} />)
    expect(screen.getByRole('grid')).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(7)
  })

  it('当該月の日が gridcell として 28〜31 個含まれる（前後月日含めて 35 or 42）', () => {
    render(<BonsaiCalendarMonthGrid anchor={new Date(2026, 3, 1)} logs={[]} records={[]} posts={[]} onSelectDate={() => {}} />)
    const cells = screen.getAllByRole('gridcell')
    // 7×5 or 7×6 のいずれか
    expect([35, 42]).toContain(cells.length)
  })

  it('ログがある日のセルの aria-label に件数が表示される', () => {
    const logs: CareLogListItem[] = [
      {
        id: 'a',
        type: BonsaiCareType.pesticide,
        performedAt: new Date(2026, 3, 15, 10, 0),
        note: null,
      },
    ]
    render(<BonsaiCalendarMonthGrid anchor={new Date(2026, 3, 1)} logs={logs} records={[]} posts={[]} onSelectDate={() => {}} />)
    const cell = screen.getAllByRole('gridcell').find(
      (c) => c.getAttribute('aria-label')?.includes('4月15日'),
    )
    expect(cell?.getAttribute('aria-label')).toContain('消毒')
  })

  it('成長記録 / タグ付け投稿のドットも該当日に描画される', () => {
    const records: BonsaiRecordCalendarItem[] = [
      {
        id: 'r1',
        bonsaiId: 'b1',
        bonsaiName: '黒松',
        content: null,
        recordAt: new Date(2026, 3, 10, 9, 0),
        imageCount: 0,
      },
    ]
    const posts: BonsaiPostCalendarItem[] = [
      {
        id: 'p1',
        bonsaiId: 'b1',
        bonsaiName: '黒松',
        content: null,
        createdAt: new Date(2026, 3, 12, 9, 0),
        mediaCount: 0,
      },
    ]
    const { container } = render(
      <BonsaiCalendarMonthGrid
        anchor={new Date(2026, 3, 1)}
        logs={[]}
        records={records}
        posts={posts}
        onSelectDate={() => {}}
      />,
    )
    expect(container.querySelector('[data-overlay-kind="record"]')).not.toBeNull()
    expect(container.querySelector('[data-overlay-kind="post"]')).not.toBeNull()
  })

  it('日付クリックで onSelectDate が呼ばれる', () => {
    const onSelectDate = vi.fn()
    render(<BonsaiCalendarMonthGrid anchor={new Date(2026, 3, 1)} logs={[]} records={[]} posts={[]} onSelectDate={onSelectDate} />)
    const cells = screen.getAllByRole('gridcell')
    fireEvent.click(cells[10])
    expect(onSelectDate).toHaveBeenCalledTimes(1)
    expect(onSelectDate).toHaveBeenCalledWith(expect.any(Date))
  })

  it('うるう年 2024-02 の日数判定で 29 日が含まれる', () => {
    render(<BonsaiCalendarMonthGrid anchor={new Date(2024, 1, 1)} logs={[]} records={[]} posts={[]} onSelectDate={() => {}} />)
    const cell = screen.getAllByRole('gridcell').find(
      (c) => c.getAttribute('aria-label')?.includes('2024年2月29日'),
    )
    expect(cell).toBeDefined()
  })

  it('非うるう年 2025-02 では 29 日は前月扱いで含まれない（ただし表示されない月の日が表示される可能性あり）', () => {
    // 2025-02 は 28 日なので、月内に 2025-02-29 は存在しない。前月や翌月に重ならないことを確認
    render(<BonsaiCalendarMonthGrid anchor={new Date(2025, 1, 1)} logs={[]} records={[]} posts={[]} onSelectDate={() => {}} />)
    const allCells = screen.getAllByRole('gridcell')
    const has2025Feb29 = allCells.some(
      (c) => c.getAttribute('aria-label')?.includes('2025年2月29日'),
    )
    expect(has2025Feb29).toBe(false)
  })
})
