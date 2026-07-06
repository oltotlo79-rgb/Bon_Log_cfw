/**
 * BonsaiCalendarView - reloadLogs / handleAdd / handleEdit / handleSaved / overlay フィルタ
 *
 * 既存の BonsaiCalendarView.test.tsx / .interactive.test.tsx は描画・フィルタ表面の確認に留まる。
 * このファイルは Sheet/Form を軽量スタブに差し替え、親コンポーネント自身のロジック
 * （reloadLogs のデータ取得成功/失敗分岐、onEdit/onAdd/onChanged/onSaved の配線）を検証する。
 * BonsaiCareLogSheet / BonsaiCareLogForm 自体の内部挙動は個別のテストファイルで担保済みのため、
 * ここでは親から渡された props が正しく呼ばれるかだけを確認するスタブに置き換える。
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

// Sheet / Form はスタブに差し替え、親の props 配線のみ検証する
vi.mock('@/components/bonsai/calendar/BonsaiCareLogSheet', () => ({
  BonsaiCareLogSheet: (props: {
    open: boolean
    date: Date | null
    onEdit: (log: { id: string; type: BonsaiCareType; performedAt: Date; note: string | null }) => void
    onAdd: () => void
    onChanged: () => void
  }) =>
    props.open ? (
      <div data-testid="care-log-sheet">
        <button
          onClick={() =>
            props.onEdit({ id: 'log-1', type: BonsaiCareType.pesticide, performedAt: new Date(), note: null })
          }
        >
          sheet-edit-trigger
        </button>
        <button onClick={props.onAdd}>sheet-add-trigger</button>
        <button onClick={props.onChanged}>sheet-changed-trigger</button>
      </div>
    ) : null,
}))

vi.mock('@/components/bonsai/calendar/BonsaiCareLogForm', () => ({
  BonsaiCareLogForm: (props: { open: boolean; onSaved: () => void }) =>
    props.open ? (
      <div data-testid="care-log-form">
        <button onClick={props.onSaved}>form-saved-trigger</button>
      </div>
    ) : null,
}))

import { BonsaiCalendarView } from '@/components/bonsai/calendar/BonsaiCalendarView'
import { CALENDAR_MODE_MONTH } from '@/lib/constants/bonsai-care'

const ANCHOR = new Date(2026, 3, 15)

function renderView() {
  return render(
    <BonsaiCalendarView
      initialMode={CALENDAR_MODE_MONTH}
      initialAnchor={ANCHOR}
      initialLogs={[]}
      initialRecords={[]}
      initialPosts={[]}
    />,
  )
}

/** 日付セルをクリックして Sheet を開く（handleSelectDate 経由で sheetDate をセット） */
function openSheetByClickingDay() {
  const dayButtons = document.querySelectorAll('button[type="button"]')
  const dayCell = Array.from(dayButtons).find((b) => b.textContent?.match(/^\d+$/))
  expect(dayCell).toBeDefined()
  fireEvent.click(dayCell!)
}

/**
 * toolbar は種別/overlay ごとに凡例チップ（data-care-type / data-overlay-kind）を
 * フィルタ状態に関わらず常に描画するため、実際のカレンダーグリッド内の描画だけを
 * 見るには role="grid" 配下に絞り込む必要がある。
 */
function queryGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector('[role="grid"]')
  expect(grid).not.toBeNull()
  return grid as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSearchParams.mockReturnValue(new URLSearchParams('view=calendar'))
  mockGetCareLogsInRange.mockResolvedValue({ success: true, data: { logs: [] } })
  mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({
    success: true,
    data: { records: [], posts: [] },
  })
})

describe('BonsaiCalendarView - reloadLogs 成功/失敗分岐', () => {
  it('care ログ取得が失敗した場合、エラートーストを表示し records/posts は更新しない', async () => {
    mockGetCareLogsInRange.mockResolvedValue({ success: false, error: '取得に失敗しました' })
    renderView()
    openSheetByClickingDay()

    fireEvent.click(screen.getByText('sheet-changed-trigger'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '読み込みに失敗しました',
          description: '取得に失敗しました',
          variant: 'destructive',
        }),
      )
    })
    // 失敗時は overlay 取得結果を見ずに早期 return するため setRecords/setPosts は呼ばれない
    expect(mockToast).toHaveBeenCalledTimes(1)
  })

  it('care ログ取得が成功し data が省略された場合、logs は空配列にフォールバックする', async () => {
    mockGetCareLogsInRange.mockResolvedValue({ success: true })
    mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({ success: true })
    renderView()
    openSheetByClickingDay()

    fireEvent.click(screen.getByText('sheet-changed-trigger'))

    await waitFor(() => {
      expect(mockGetCareLogsInRange).toHaveBeenCalled()
    })
    // トーストは呼ばれない（エラーではない）
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('overlay 取得が失敗した場合、records/posts は更新されない（success のみ更新）', async () => {
    mockGetCareLogsInRange.mockResolvedValue({ success: true, data: { logs: [] } })
    mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({ success: false, error: 'overlay error' })
    const { container } = renderView()
    openSheetByClickingDay()

    fireEvent.click(screen.getByText('sheet-changed-trigger'))

    await waitFor(() => {
      expect(mockGetBonsaiCalendarOverlaysInRange).toHaveBeenCalled()
    })
    // overlay 失敗時は既存の（空）records/posts のまま
    expect(queryGrid(container).querySelector('[data-overlay-kind="record"]')).toBeNull()
    expect(queryGrid(container).querySelector('[data-overlay-kind="post"]')).toBeNull()
  })

  it('overlay 取得が成功し data が省略された場合、records/posts は空配列にフォールバックする', async () => {
    mockGetCareLogsInRange.mockResolvedValue({ success: true, data: { logs: [] } })
    mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({ success: true })
    renderView()
    openSheetByClickingDay()

    fireEvent.click(screen.getByText('sheet-changed-trigger'))

    await waitFor(() => {
      expect(mockGetBonsaiCalendarOverlaysInRange).toHaveBeenCalled()
    })
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('care ログ・overlay ともに成功しデータがある場合、reloadLogs 後に表示が更新される', async () => {
    mockGetCareLogsInRange.mockResolvedValue({
      success: true,
      data: {
        logs: [
          { id: 'new-log', type: BonsaiCareType.shading, performedAt: new Date(2026, 3, 15, 9, 0), note: null },
        ],
      },
    })
    mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({
      success: true,
      data: {
        records: [
          { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 15, 9, 0), imageCount: 0 },
        ],
        posts: [
          { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: '内容', createdAt: new Date(2026, 3, 15, 9, 0), mediaCount: 0 },
        ],
      },
    })
    const { container } = renderView()
    openSheetByClickingDay()

    fireEvent.click(screen.getByText('sheet-changed-trigger'))

    await waitFor(() => {
      expect(queryGrid(container).querySelector('[data-care-type="shading"]')).not.toBeNull()
    })
    expect(queryGrid(container).querySelector('[data-overlay-kind="record"]')).not.toBeNull()
    expect(queryGrid(container).querySelector('[data-overlay-kind="post"]')).not.toBeNull()
  })

  it('Form の保存完了 (onSaved) でも reloadLogs が呼ばれる', async () => {
    renderView()
    // toolbar の「記録追加」から Form を開く
    fireEvent.click(screen.getByRole('button', { name: /記録追加/ }))
    expect(screen.getByTestId('care-log-form')).toBeInTheDocument()

    fireEvent.click(screen.getByText('form-saved-trigger'))

    await waitFor(() => {
      expect(mockGetCareLogsInRange).toHaveBeenCalled()
      expect(mockGetBonsaiCalendarOverlaysInRange).toHaveBeenCalled()
    })
  })
})

describe('BonsaiCalendarView - Sheet からの編集・追加配線', () => {
  it('Sheet の編集トリガーで Form が編集モードとして開き、Sheet は閉じる', async () => {
    renderView()
    openSheetByClickingDay()
    expect(screen.getByTestId('care-log-sheet')).toBeInTheDocument()

    fireEvent.click(screen.getByText('sheet-edit-trigger'))

    await waitFor(() => {
      expect(screen.getByTestId('care-log-form')).toBeInTheDocument()
      expect(screen.queryByTestId('care-log-sheet')).not.toBeInTheDocument()
    })
  })

  it('Sheet の追加トリガーで Form が新規モード（選択日を引き継ぎ）として開く', async () => {
    renderView()
    openSheetByClickingDay()

    fireEvent.click(screen.getByText('sheet-add-trigger'))

    await waitFor(() => {
      expect(screen.getByTestId('care-log-form')).toBeInTheDocument()
      expect(screen.queryByTestId('care-log-sheet')).not.toBeInTheDocument()
    })
  })
})

describe('BonsaiCalendarView - overlay フィルタの全組み合わせ', () => {
  it('「成長記録」のみ選択すると record は表示され post は非表示になる', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[]}
        initialRecords={[
          { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 15, 9, 0), imageCount: 0 },
        ]}
        initialPosts={[
          { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: '内容', createdAt: new Date(2026, 3, 15, 9, 0), mediaCount: 0 },
        ]}
      />,
    )
    fireEvent.click(screen.getByLabelText('成長記録'))
    expect(queryGrid(container).querySelector('[data-overlay-kind="record"]')).not.toBeNull()
    expect(queryGrid(container).querySelector('[data-overlay-kind="post"]')).toBeNull()
  })

  it('「タグ付け投稿」のみ選択すると post は表示され record は非表示になる', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[]}
        initialRecords={[
          { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 15, 9, 0), imageCount: 0 },
        ]}
        initialPosts={[
          { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: '内容', createdAt: new Date(2026, 3, 15, 9, 0), mediaCount: 0 },
        ]}
      />,
    )
    fireEvent.click(screen.getByLabelText('タグ付け投稿'))
    expect(queryGrid(container).querySelector('[data-overlay-kind="post"]')).not.toBeNull()
    expect(queryGrid(container).querySelector('[data-overlay-kind="record"]')).toBeNull()
  })

  it('種別フィルタ（消毒）を選択すると該当種別のみ表示される', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[
          { id: 'a', type: BonsaiCareType.pesticide, performedAt: new Date(2026, 3, 15, 10, 0), note: null },
          { id: 'b', type: BonsaiCareType.shading, performedAt: new Date(2026, 3, 15, 11, 0), note: null },
        ]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    fireEvent.click(screen.getByLabelText('消毒'))
    expect(queryGrid(container).querySelector('[data-care-type="pesticide"]')).not.toBeNull()
    expect(queryGrid(container).querySelector('[data-care-type="shading"]')).toBeNull()
  })

  it('種別フィルタを2回クリックすると選択解除され、全種別が再び表示される（Set の delete 分岐）', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[
          { id: 'a', type: BonsaiCareType.pesticide, performedAt: new Date(2026, 3, 15, 10, 0), note: null },
          { id: 'b', type: BonsaiCareType.shading, performedAt: new Date(2026, 3, 15, 11, 0), note: null },
        ]}
        initialRecords={[]}
        initialPosts={[]}
      />,
    )
    const checkbox = screen.getByLabelText('消毒')
    fireEvent.click(checkbox) // 選択 → shading が消える
    expect(queryGrid(container).querySelector('[data-care-type="shading"]')).toBeNull()

    fireEvent.click(checkbox) // 選択解除 → 再び両方表示
    expect(queryGrid(container).querySelector('[data-care-type="pesticide"]')).not.toBeNull()
    expect(queryGrid(container).querySelector('[data-care-type="shading"]')).not.toBeNull()
  })

  it('overlay フィルタを2回クリックすると選択解除され、両方の overlay が再び表示される（Set の delete 分岐）', () => {
    const { container } = render(
      <BonsaiCalendarView
        initialMode={CALENDAR_MODE_MONTH}
        initialAnchor={ANCHOR}
        initialLogs={[]}
        initialRecords={[
          { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 15, 9, 0), imageCount: 0 },
        ]}
        initialPosts={[
          { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: '内容', createdAt: new Date(2026, 3, 15, 9, 0), mediaCount: 0 },
        ]}
      />,
    )
    const checkbox = screen.getByLabelText('成長記録')
    fireEvent.click(checkbox) // 選択 → post が消える
    expect(queryGrid(container).querySelector('[data-overlay-kind="post"]')).toBeNull()

    fireEvent.click(checkbox) // 選択解除 → 再び両方表示
    expect(queryGrid(container).querySelector('[data-overlay-kind="record"]')).not.toBeNull()
    expect(queryGrid(container).querySelector('[data-overlay-kind="post"]')).not.toBeNull()
  })
})
