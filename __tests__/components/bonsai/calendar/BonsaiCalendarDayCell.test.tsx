import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BonsaiCareType } from '@prisma/client'

import { BonsaiCalendarDayCell } from '@/components/bonsai/calendar/BonsaiCalendarDayCell'
import {
  BONSAI_CARE_COLOR_CLASS,
  CALENDAR_OVERLAY_COLOR_CLASS,
  CALENDAR_OVERLAY_POST,
  CALENDAR_OVERLAY_RECORD,
} from '@/lib/constants/bonsai-care'
import type { CareLogListItem } from '@/types/bonsai-care'

const makeLog = (id: string, type: BonsaiCareType): CareLogListItem => ({
  id,
  type,
  performedAt: new Date(2026, 3, 15, 10, 0),
  note: null,
})

describe('BonsaiCalendarDayCell', () => {
  it('date=null は aria-hidden の空表示で gridcell でない', () => {
    const { container } = render(
      <BonsaiCalendarDayCell date={null} logs={[]} compact />,
    )
    const hiddenDiv = container.querySelector('[aria-hidden="true"]')
    expect(hiddenDiv).not.toBeNull()
    expect(screen.queryByRole('gridcell')).toBeNull()
  })

  it('ログなし: 日付のみ表示し、ドットは出ない', () => {
    render(
      <BonsaiCalendarDayCell date={new Date(2026, 3, 15)} logs={[]} />,
    )
    expect(screen.getByText('15')).toBeInTheDocument()
    const cell = screen.getByRole('gridcell')
    expect(cell).toHaveAttribute('aria-label', expect.stringContaining('記録なし'))
  })

  it('ログあり: 種別ごとに色ドットが描画される', () => {
    const logs = [
      makeLog('a', BonsaiCareType.pesticide),
      makeLog('b', BonsaiCareType.shading),
    ]
    const { container } = render(
      <BonsaiCalendarDayCell date={new Date(2026, 3, 15)} logs={logs} />,
    )
    expect(container.querySelector(`[data-care-type="pesticide"]`)).not.toBeNull()
    expect(container.querySelector(`[data-care-type="shading"]`)).not.toBeNull()
  })

  it('色クラスは BONSAI_CARE_COLOR_CLASS と一致', () => {
    const { container } = render(
      <BonsaiCalendarDayCell
        date={new Date(2026, 3, 15)}
        logs={[makeLog('a', BonsaiCareType.pesticide)]}
      />,
    )
    const dot = container.querySelector(`[data-care-type="pesticide"]`)
    expect(dot?.className).toContain(BONSAI_CARE_COLOR_CLASS[BonsaiCareType.pesticide])
  })

  it('種別が MAX_DOTS_PER_CELL を超えると +N 表示', () => {
    const logs = [
      makeLog('a', BonsaiCareType.pesticide),
      makeLog('b', BonsaiCareType.shading),
      makeLog('c', BonsaiCareType.solid_fertilizer),
      makeLog('d', BonsaiCareType.liquid_fertilizer),
      makeLog('e', BonsaiCareType.rotate),
    ]
    const { container } = render(
      <BonsaiCalendarDayCell date={new Date(2026, 3, 15)} logs={logs} />,
    )
    const overflow = container.querySelector('[data-overflow="true"]')
    expect(overflow).not.toBeNull()
    // 5 種類 - 3 = 2
    expect(overflow?.textContent).toBe('+2')
  })

  it('aria-label に件数と種別ラベルを含む', () => {
    const logs = [
      makeLog('a', BonsaiCareType.pesticide),
      makeLog('b', BonsaiCareType.shading),
    ]
    render(<BonsaiCalendarDayCell date={new Date(2026, 3, 15)} logs={logs} />)
    const cell = screen.getByRole('gridcell')
    const label = cell.getAttribute('aria-label') ?? ''
    expect(label).toContain('消毒')
    expect(label).toContain('遮光')
    expect(label).toContain('2件')
  })

  it('クリックで onSelect が日付付きで呼ばれる', () => {
    const onSelect = vi.fn()
    const date = new Date(2026, 3, 15)
    render(<BonsaiCalendarDayCell date={date} logs={[]} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('gridcell'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(date)
  })

  it('Enter キーで onSelect が呼ばれる', () => {
    const onSelect = vi.fn()
    const date = new Date(2026, 3, 15)
    render(<BonsaiCalendarDayCell date={date} logs={[]} onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('gridcell'), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(date)
  })

  it('Space キーで onSelect が呼ばれる', () => {
    const onSelect = vi.fn()
    const date = new Date(2026, 3, 15)
    render(<BonsaiCalendarDayCell date={date} logs={[]} onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('gridcell'), { key: ' ' })
    expect(onSelect).toHaveBeenCalledWith(date)
  })

  it('compact プロパティで圧縮スタイル', () => {
    const { container } = render(
      <BonsaiCalendarDayCell
        date={new Date(2026, 3, 15)}
        logs={[makeLog('a', BonsaiCareType.pesticide)]}
        compact
      />,
    )
    const cell = container.querySelector('[role="gridcell"]')
    expect(cell?.className).toContain('h-8')
  })

  it('recordCount > 0 で record ドットを描画する', () => {
    const { container } = render(
      <BonsaiCalendarDayCell
        date={new Date(2026, 3, 15)}
        logs={[]}
        recordCount={2}
      />,
    )
    const dot = container.querySelector(`[data-overlay-kind="${CALENDAR_OVERLAY_RECORD}"]`)
    expect(dot).not.toBeNull()
    expect(dot?.className).toContain(CALENDAR_OVERLAY_COLOR_CLASS[CALENDAR_OVERLAY_RECORD])
  })

  it('postCount > 0 で post ドットを描画する', () => {
    const { container } = render(
      <BonsaiCalendarDayCell
        date={new Date(2026, 3, 15)}
        logs={[]}
        postCount={1}
      />,
    )
    const dot = container.querySelector(`[data-overlay-kind="${CALENDAR_OVERLAY_POST}"]`)
    expect(dot).not.toBeNull()
    expect(dot?.className).toContain(CALENDAR_OVERLAY_COLOR_CLASS[CALENDAR_OVERLAY_POST])
  })

  it('aria-label に成長記録 / タグ付け投稿の件数を含む', () => {
    render(
      <BonsaiCalendarDayCell
        date={new Date(2026, 3, 15)}
        logs={[]}
        recordCount={3}
        postCount={2}
      />,
    )
    const label = screen.getByRole('gridcell').getAttribute('aria-label') ?? ''
    expect(label).toContain('成長記録3件')
    expect(label).toContain('タグ付け投稿2件')
    expect(label).not.toContain('記録なし')
  })

  it('overlay があると care 種別ドットの表示数が overlay の分減る', () => {
    // care 種別 3 種 + record 1 + post 1 = MAX(3) を超えるが、overflow ではなく care 側を縮める
    const logs = [
      makeLog('a', BonsaiCareType.pesticide),
      makeLog('b', BonsaiCareType.shading),
      makeLog('c', BonsaiCareType.solid_fertilizer),
    ]
    const { container } = render(
      <BonsaiCalendarDayCell
        date={new Date(2026, 3, 15)}
        logs={logs}
        recordCount={1}
        postCount={1}
      />,
    )
    // overlay 2 つで slot を取るため、care ドットは 3 - 2 = 1 個まで
    const careDots = container.querySelectorAll('[data-care-type]')
    expect(careDots).toHaveLength(1)
    // 残り 2 種類は overflow に
    const overflow = container.querySelector('[data-overflow="true"]')
    expect(overflow?.textContent).toBe('+2')
  })
})
