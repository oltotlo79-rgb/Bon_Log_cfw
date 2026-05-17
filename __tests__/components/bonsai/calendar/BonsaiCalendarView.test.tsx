import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BonsaiCareType } from '@prisma/client'

const mockGetCareLogsInRange = vi.fn()
const mockGetBonsaiCalendarOverlaysInRange = vi.fn()
vi.mock('@/lib/actions/bonsai-care-log', () => ({
  getCareLogsInRange: (...args: unknown[]) => mockGetCareLogsInRange(...args),
  getBonsaiCalendarOverlaysInRange: (...args: unknown[]) =>
    mockGetBonsaiCalendarOverlaysInRange(...args),
  addBonsaiCareLog: vi.fn(),
  updateBonsaiCareLog: vi.fn(),
  deleteBonsaiCareLog: vi.fn(),
}))

const mockUseSearchParams = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
    useSearchParams: () => mockUseSearchParams(),
  }
})

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { BonsaiCalendarView } from '@/components/bonsai/calendar/BonsaiCalendarView'
import {
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_MONTH,
  CALENDAR_MODE_YEAR,
} from '@/lib/constants/bonsai-care'

describe('BonsaiCalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearchParams.mockReturnValue(new URLSearchParams('view=calendar'))
  })

  it('mode=month で月ビュー（曜日ヘッダ 7 個）を描画', () => {
    render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={new Date(2026, 3, 1)}
        initialLogs={[]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(7)
  })

  it('mode=half-year で 6 列ヘッダ', () => {
    render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_HALF_YEAR}
        initialAnchor={new Date(2026, 3, 1)}
        initialLogs={[]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(6)
  })

  it('mode=year で 12 列ヘッダ', () => {
    render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_YEAR}
        initialAnchor={new Date(2026, 3, 1)}
        initialLogs={[]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(12)
  })

  it('initialLogs を反映してドットを描画', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={new Date(2026, 3, 1)}
        initialLogs={[
          {
            id: 'a',
            type: BonsaiCareType.pesticide,
            performedAt: new Date(2026, 3, 15, 10, 0),
            note: null,
          },
        ]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    expect(container.querySelector(`[data-care-type="pesticide"]`)).not.toBeNull()
  })

  it('種別フィルタはクライアント側で適用される', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={new Date(2026, 3, 1)}
        initialLogs={[
          {
            id: 'a',
            type: BonsaiCareType.pesticide,
            performedAt: new Date(2026, 3, 15, 10, 0),
            note: null,
          },
          {
            id: 'b',
            type: BonsaiCareType.shading,
            performedAt: new Date(2026, 3, 15, 11, 0),
            note: null,
          },
        ]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    // 初期状態: 両方の色ドットが描画
    expect(container.querySelector(`[data-care-type="pesticide"]`)).not.toBeNull()
    expect(container.querySelector(`[data-care-type="shading"]`)).not.toBeNull()
  })

  it('initialRecords と initialPosts のドットも描画される', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={new Date(2026, 3, 1)}
        initialLogs={[]}
        initialRecords={[
          {
            id: 'r1',
            bonsaiId: 'b1',
            bonsaiName: '黒松',
            content: null,
            recordAt: new Date(2026, 3, 10, 9, 0),
            imageCount: 0,
          },
        ]}
        initialPosts={[
          {
            id: 'p1',
            bonsaiId: 'b1',
            bonsaiName: '黒松',
            content: '剪定した',
            createdAt: new Date(2026, 3, 12, 9, 0),
            mediaCount: 1,
          },
        ]}
      />,
    )
    expect(container.querySelector('[data-overlay-kind="record"]')).not.toBeNull()
    expect(container.querySelector('[data-overlay-kind="post"]')).not.toBeNull()
  })

  it('tabpanel role を持つ', () => {
    render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={new Date(2026, 3, 1)}
        initialLogs={[]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-label', '盆栽手入れカレンダー')
  })
})
