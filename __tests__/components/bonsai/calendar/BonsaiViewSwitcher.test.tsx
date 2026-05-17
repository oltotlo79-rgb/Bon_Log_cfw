import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { BonsaiViewSwitcher } from '@/components/bonsai/calendar/BonsaiViewSwitcher'
import {
  BONSAI_VIEW_CALENDAR,
  BONSAI_VIEW_TIMELINE,
} from '@/lib/constants/bonsai-care'

const mockUseSearchParams = vi.fn()
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    useSearchParams: () => mockUseSearchParams(),
  }
})

function setQuery(qs: string) {
  mockUseSearchParams.mockReturnValue(new URLSearchParams(qs))
}

describe('BonsaiViewSwitcher', () => {
  it('現在ビューが calendar の場合、calendar タブが selected', () => {
    setQuery('view=calendar')
    render(<BonsaiViewSwitcher current={BONSAI_VIEW_CALENDAR} />)
    const calendarTab = screen.getByRole('tab', { name: /カレンダー/ })
    const timelineTab = screen.getByRole('tab', { name: /タイムライン/ })
    expect(calendarTab.getAttribute('aria-selected')).toBe('true')
    expect(timelineTab.getAttribute('aria-selected')).toBe('false')
  })

  it('現在ビューが timeline の場合、timeline タブが selected', () => {
    setQuery('')
    render(<BonsaiViewSwitcher current={BONSAI_VIEW_TIMELINE} />)
    const calendarTab = screen.getByRole('tab', { name: /カレンダー/ })
    const timelineTab = screen.getByRole('tab', { name: /タイムライン/ })
    expect(timelineTab.getAttribute('aria-selected')).toBe('true')
    expect(calendarTab.getAttribute('aria-selected')).toBe('false')
  })

  it('href に view=calendar を含む（クエリ既存パラメータを保持）', () => {
    setQuery('mode=year&anchor=2026-04')
    render(<BonsaiViewSwitcher current={BONSAI_VIEW_TIMELINE} />)
    const calendarTab = screen.getByRole('tab', { name: /カレンダー/ })
    const href = calendarTab.getAttribute('href') ?? ''
    expect(href).toContain('view=calendar')
    expect(href).toContain('mode=year')
    expect(href).toContain('anchor=2026-04')
  })

  it('timeline へのリンクは mode/anchor を削除する', () => {
    setQuery('view=calendar&mode=year&anchor=2026-04')
    render(<BonsaiViewSwitcher current={BONSAI_VIEW_CALENDAR} />)
    const timelineTab = screen.getByRole('tab', { name: /タイムライン/ })
    const href = timelineTab.getAttribute('href') ?? ''
    expect(href).toContain('view=timeline')
    expect(href).not.toContain('mode=')
    expect(href).not.toContain('anchor=')
  })

  it('tablist と aria-label を持つ', () => {
    setQuery('')
    render(<BonsaiViewSwitcher current={BONSAI_VIEW_TIMELINE} />)
    const list = screen.getByRole('tablist')
    expect(list.getAttribute('aria-label')).toBe('盆栽の表示形式')
  })
})
