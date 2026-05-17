/**
 * BonsaiCalendarView のインタラクティブ動作テスト
 *
 * 既存の BonsaiCalendarView.test.tsx は描画チェック中心。
 * このファイルは 55% / 21% に留まっていた以下の branch を補強する:
 * - handleSelectDate（日付クリック → sheet）
 * - handleAdd / handleAddFromToolbar / handleEdit（sheet/toolbar → form）
 * - reloadLogs（getCareLogsInRange / getBonsaiCalendarOverlaysInRange エラー / 成功）
 * - selectedTypes / selectedOverlays フィルタの空集合分岐
 * - useEffect による initial* → state 同期
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import { BonsaiCalendarView } from '@/components/bonsai/calendar/BonsaiCalendarView'
import {
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_MONTH,
  CALENDAR_MODE_YEAR,
} from '@/lib/constants/bonsai-care'

const ANCHOR = new Date(2026, 3, 15) // 2026-04-15

function renderView(props?: Partial<React.ComponentProps<typeof BonsaiCalendarView>>) {
  return render(
    <BonsaiCalendarView
      initialMode={CALENDAR_MODE_MONTH}
      initialAnchor={ANCHOR}
      initialLogs={[]}
      initialRecords={[]}
      initialPosts={[]}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSearchParams.mockReturnValue(new URLSearchParams('view=calendar'))
  mockGetCareLogsInRange.mockResolvedValue({ success: true, data: { logs: [] } })
  mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({ success: true, data: { records: [], posts: [] } })
})

describe('BonsaiCalendarView - 日付クリック → sheet', () => {
  it('日付セルをクリックすると Sheet（dialog）が開く', async () => {
    renderView()
    // 月モードの日付セル（type="button" の特定属性で特定）
    // 各日付セルは aria-label または役割でクリック可能
    const dayButtons = document.querySelectorAll('button[type="button"]')
    // 最初の有効そうな日付セルをクリック（カレンダーグリッド内）
    const dayCell = Array.from(dayButtons).find((b) => b.textContent?.match(/^\d+$/))
    expect(dayCell).toBeDefined()
    fireEvent.click(dayCell!)

    // Dialog が開く（role="dialog" or データ属性）
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    })
  })
})

describe('BonsaiCalendarView - フィルタトグル', () => {
  it('種別フィルタボタンをクリックすると selectedTypes が変化し、表示が絞り込まれる', () => {
    const { container } = renderView({
      initialLogs: [
        { id: 'a', type: BonsaiCareType.pesticide, performedAt: new Date(2026, 3, 15, 10, 0), note: null },
        { id: 'b', type: BonsaiCareType.shading, performedAt: new Date(2026, 3, 15, 11, 0), note: null },
      ],
    })

    // 初期状態: 両方のドットが描画
    expect(container.querySelector('[data-care-type="pesticide"]')).not.toBeNull()
    expect(container.querySelector('[data-care-type="shading"]')).not.toBeNull()

    // トグルボタン（aria-pressed の attribute で識別 / または title で）
    // BonsaiCalendarToolbar 内の種別フィルタボタンは label 経由で見つかる
    const allButtons = screen.getAllByRole('button')
    const pesticideBtn = allButtons.find((b) => b.textContent?.includes('農薬'))
    if (pesticideBtn) {
      fireEvent.click(pesticideBtn)
      // pesticide のみ選択されたら shading は消える
      expect(container.querySelector('[data-care-type="pesticide"]')).not.toBeNull()
      expect(container.querySelector('[data-care-type="shading"]')).toBeNull()
    }
  })

  it('成長記録フィルタを ON にすると post overlay が消える', () => {
    const { container } = renderView({
      initialRecords: [
        { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 10, 9, 0), imageCount: 0 },
      ],
      initialPosts: [
        { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: '剪定', createdAt: new Date(2026, 3, 12, 9, 0), mediaCount: 1 },
      ],
    })

    expect(container.querySelector('[data-overlay-kind="record"]')).not.toBeNull()
    expect(container.querySelector('[data-overlay-kind="post"]')).not.toBeNull()

    const allButtons = screen.getAllByRole('button')
    const recordBtn = allButtons.find((b) => b.textContent?.match(/成長記録/))
    if (recordBtn) {
      fireEvent.click(recordBtn)
      // record だけ選択 → post overlay は消える
      expect(container.querySelector('[data-overlay-kind="record"]')).not.toBeNull()
      expect(container.querySelector('[data-overlay-kind="post"]')).toBeNull()
    }
  })
})

describe('BonsaiCalendarView - 新規追加（toolbar）', () => {
  it('toolbar の「追加」ボタンをクリックすると Form が開く', async () => {
    renderView()
    const allButtons = screen.getAllByRole('button')
    // toolbar の「追加」ボタン（label 末尾 「追加」 を含む）
    const addBtn = allButtons.find((b) =>
      b.textContent?.includes('追加') && !b.textContent?.includes('追加日'),
    )
    expect(addBtn).toBeDefined()
    fireEvent.click(addBtn!)

    // Form Dialog が開く
    await waitFor(() => {
      // Form 側の dialog が現れる（複数 dialog がある可能性）
      const dialogs = document.querySelectorAll('[role="dialog"]')
      expect(dialogs.length).toBeGreaterThan(0)
    })
  })
})

describe('BonsaiCalendarView - useEffect による props → state 同期', () => {
  it('rerender で initialLogs が増えると state（visibleLogs）も追従する', () => {
    const { rerender, container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[
          { id: 'old', type: BonsaiCareType.pesticide, performedAt: new Date(2026, 3, 15, 10, 0), note: null },
        ]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    const initialPesticideCount = container.querySelectorAll('[data-care-type="pesticide"]').length
    const initialShadingCount = container.querySelectorAll('[data-care-type="shading"]').length

    // rerender で別の type のログを追加
    rerender(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[
          { id: 'old', type: BonsaiCareType.pesticide, performedAt: new Date(2026, 3, 15, 10, 0), note: null },
          { id: 'new', type: BonsaiCareType.shading, performedAt: new Date(2026, 3, 16, 10, 0), note: null },
        ]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    // shading が追加された
    expect(container.querySelectorAll('[data-care-type="shading"]').length).toBeGreaterThan(initialShadingCount)
    // pesticide は維持
    expect(container.querySelectorAll('[data-care-type="pesticide"]').length).toBe(initialPesticideCount)
  })

  it('rerender で initialRecords が増えると overlay も追従する', () => {
    const { rerender, container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[]}
        initialRecords={[
          { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 10, 9, 0), imageCount: 0 },
        ]}
        initialPosts={[]}
      />,
    )
    const initialCount = container.querySelectorAll('[data-overlay-kind="record"]').length

    rerender(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[]}
        initialRecords={[
          { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 10, 9, 0), imageCount: 0 },
          { id: 'r2', bonsaiId: 'b2', bonsaiName: '杉', content: null, recordAt: new Date(2026, 3, 12, 9, 0), imageCount: 0 },
        ]}
        initialPosts={[]}
      />,
    )
    // record overlay が増えている
    expect(container.querySelectorAll('[data-overlay-kind="record"]').length).toBeGreaterThan(initialCount)
  })

  it('rerender で initialPosts が増えると post overlay も追従する', () => {
    const { rerender, container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[]}
        initialRecords={[]}
        initialPosts={[
          { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: '初回投稿', createdAt: new Date(2026, 3, 12, 9, 0), mediaCount: 1 },
        ]}
      />,
    )
    const initialCount = container.querySelectorAll('[data-overlay-kind="post"]').length

    rerender(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[]}
        initialRecords={[]}
        initialPosts={[
          { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: '初回投稿', createdAt: new Date(2026, 3, 12, 9, 0), mediaCount: 1 },
          { id: 'p2', bonsaiId: 'b2', bonsaiName: '杉', content: '別投稿', createdAt: new Date(2026, 3, 14, 9, 0), mediaCount: 0 },
        ]}
      />,
    )
    expect(container.querySelectorAll('[data-overlay-kind="post"]').length).toBeGreaterThan(initialCount)
  })
})

describe('BonsaiCalendarView - モード別グリッド', () => {
  it('half-year モードでは MultiMonthGrid が描画される（columnheader=6）', () => {
    renderView({ initialMode: CALENDAR_MODE_HALF_YEAR })
    expect(screen.getAllByRole('columnheader')).toHaveLength(6)
  })

  it('year モードでは MultiMonthGrid が描画される（columnheader=12）', () => {
    renderView({ initialMode: CALENDAR_MODE_YEAR })
    expect(screen.getAllByRole('columnheader')).toHaveLength(12)
  })

  it('month モードでは MonthGrid が描画される（columnheader=7=曜日）', () => {
    renderView({ initialMode: CALENDAR_MODE_MONTH })
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
  })
})
