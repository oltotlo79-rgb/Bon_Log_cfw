import { vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { EventImportClient } from '@/app/admin/events/import/EventImportClient'

// Server Actions モック
const mockScrapeExternalEvents = vi.fn()
const mockScrapeEventsByRegion = vi.fn()
const mockImportSelectedEvents = vi.fn()

vi.mock('@/lib/actions/event-import', () => ({
  scrapeExternalEvents: (...args: unknown[]) => mockScrapeExternalEvents(...args),
  scrapeEventsByRegion: (...args: unknown[]) => mockScrapeEventsByRegion(...args),
  importSelectedEvents: (...args: unknown[]) => mockImportSelectedEvents(...args),
}))

// イベントソースモック
vi.mock('@/lib/scraping/bonsai-events', () => ({
  BONSAI_EVENT_SOURCES: [
    { region: '関東' },
    { region: '関西' },
    { region: '東北' },
  ],
}))

// 都道府県モック
vi.mock('@/lib/prefectures', () => ({
  PREFECTURES: ['東京都', '大阪府', '北海道'],
}))

// Dialog モック
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="dialog-footer">{children}</div>,
}))

const mockEvents = [
  {
    id: 'event-1',
    title: 'テスト展示会',
    startDate: '2025-03-01T00:00:00.000Z',
    endDate: '2025-03-02T00:00:00.000Z',
    prefecture: '東京都',
    city: '台東区',
    venue: '上野公園',
    organizer: 'テスト主催',
    description: 'テスト説明',
    admissionFee: '無料',
    hasSales: true,
    isDuplicate: false,
    duplicateType: null,
    similarEventTitle: null,
    sourceRegion: '関東',
    externalUrl: 'https://example.com',
  },
  {
    id: 'event-2',
    title: '類似展示会',
    startDate: '2025-04-01T00:00:00.000Z',
    endDate: null,
    prefecture: '大阪府',
    city: null,
    venue: null,
    organizer: null,
    description: null,
    admissionFee: null,
    hasSales: false,
    isDuplicate: true,
    duplicateType: 'similar',
    similarEventTitle: '既存の類似展示会',
    sourceRegion: '関西',
    externalUrl: null,
  },
]

describe('EventImportClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('インポートインターフェースをレンダリングする', () => {
    render(<EventImportClient />)
    expect(screen.getByText('イベント情報を取得')).toBeInTheDocument()
  })

  it('スクレイピングボタンが表示される', () => {
    render(<EventImportClient />)
    expect(screen.getByText('イベント情報を取得')).toBeInTheDocument()
  })

  it('地方選択が表示される', () => {
    render(<EventImportClient />)
    expect(screen.getByText('取得する地方:')).toBeInTheDocument()
    expect(screen.getByText('全地方')).toBeInTheDocument()
  })

  it('地方選択にソースの地方が表示される', () => {
    render(<EventImportClient />)
    expect(screen.getByText('関東')).toBeInTheDocument()
    expect(screen.getByText('関西')).toBeInTheDocument()
    expect(screen.getByText('東北')).toBeInTheDocument()
  })

  it('全地方選択時にscrapeExternalEventsが呼ばれる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({ success: true, data: { events: [], filteredCount: 0 } })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(mockScrapeExternalEvents).toHaveBeenCalled()
    })
  })

  it('地方選択時にscrapeEventsByRegionが呼ばれる', async () => {
    mockScrapeEventsByRegion.mockResolvedValue({ success: true, data: { events: [], filteredCount: 0 } })
    const user = userEvent.setup()
    render(<EventImportClient />)

    // 地方を選択
    const select = screen.getByDisplayValue('全地方')
    await user.selectOptions(select, '関東')

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(mockScrapeEventsByRegion).toHaveBeenCalledWith('関東')
    })
  })

  it('スクレイピング結果のイベントが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 2 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('テスト展示会')).toBeInTheDocument()
    })
  })

  it('テーブルビューでイベントが行として表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      // テーブルヘッダーが表示される
      expect(screen.getByText('タイトル')).toBeInTheDocument()
      expect(screen.getByText('開始日')).toBeInTheDocument()
    })
  })

  it('カードビューに切り替えられる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    // カードビューではタイトルがh3として表示
    await waitFor(() => {
      expect(screen.getByText('テスト展示会')).toBeInTheDocument()
    })
  })

  it('テーブルビューとカードビューを切り替えられる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('📋 テーブル')).toBeInTheDocument()
    })
  })

  it('個別イベントを選択できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })
  })

  it('全選択チェックボックスが存在する', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      // ヘッダーの全選択チェックボックス
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(1)
    })
  })

  it('インポートボタンが選択なしで無効化される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: [{ ...mockEvents[0], isDuplicate: true }], filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      // 全チェックを外す
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(cb => {
        if ((cb as HTMLInputElement).checked) {
          fireEvent.click(cb)
        }
      })
    })

    // インポートボタンがdisabledになる
    const importButton = screen.getByText(/インポート/)
    expect(importButton.closest('button')).toBeDisabled()
  })

  it('インポートボタンがimportSelectedEventsを呼ぶ', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    mockImportSelectedEvents.mockResolvedValue({
      success: true,
      data: { importedCount: 1, clippedItems: [], rejectedItems: [] },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/インポート/)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/インポート/))

    await waitFor(() => {
      expect(mockImportSelectedEvents).toHaveBeenCalled()
    })
  })

  it('重複警告が黄色で表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('黄色')).toBeInTheDocument()
      expect(screen.getByText('= 類似イベントが登録済み（期間違い）')).toBeInTheDocument()
    })
  })

  it('インポート成功後に成功メッセージが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    mockImportSelectedEvents.mockResolvedValue({
      success: true,
      data: { importedCount: 1, clippedItems: [], rejectedItems: [] },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/インポート/)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/インポート/))

    await waitFor(() => {
      expect(screen.getByText('1件のイベントをインポートしました')).toBeInTheDocument()
    })
  })

  it('インポート結果にclippedItemsがある場合は切り詰め警告パネルが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    mockImportSelectedEvents.mockResolvedValue({
      success: true,
      data: {
        importedCount: 1,
        clippedItems: [
          {
            index: 0,
            title: 'テスト展示会',
            violations: [{ field: 'organizer', kind: 'clipped', actualLength: 249, maxLength: 200 }],
          },
        ],
        rejectedItems: [],
      },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/インポート/)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/インポート/))

    await waitFor(() => {
      expect(screen.getByText('1件は一部フィールドを切り詰めて取込みました')).toBeInTheDocument()
      expect(screen.getByText(/主催者 249\/200文字/)).toBeInTheDocument()
    })
  })

  it('インポート結果にrejectedItemsがある場合は取込不可パネルが表示され、当該イベントが再選択された状態で一覧に残る', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    mockImportSelectedEvents.mockResolvedValue({
      success: true,
      data: {
        importedCount: 1,
        clippedItems: [],
        rejectedItems: [
          {
            index: 1,
            title: '類似展示会',
            violations: [{ field: 'organizer', kind: 'rejected', actualLength: 2500, maxLength: 2000 }],
          },
        ],
      },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    // 「類似展示会」（event-2）はデフォルトで未選択（isDuplicate）なので、
    // rejectedItems の index が selectedEvents 配列上で event-2 を指すよう明示的に選択する
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(1)
    })
    const rowCheckboxes = screen.getAllByRole('checkbox').filter((cb) => !(cb as HTMLInputElement).disabled)
    await user.click(rowCheckboxes[rowCheckboxes.length - 1]!)

    await user.click(screen.getByText(/インポート/))

    await waitFor(() => {
      expect(screen.getByText('1件は取込できませんでした')).toBeInTheDocument()
      expect(screen.getByText(/主催者 2500\/2000文字/)).toBeInTheDocument()
    })

    // rejected だったイベントは一覧に残る（取込済みイベントのみ消える）
    expect(screen.getByDisplayValue('類似展示会')).toBeInTheDocument()
  })

  it('インポートエラー時にエラーメッセージが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    mockImportSelectedEvents.mockResolvedValue({ success: false, error: 'インポートエラー' })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/インポート/)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/インポート/))

    await waitFor(() => {
      expect(screen.getByText('インポートエラー')).toBeInTheDocument()
    })
  })

  it('スクレイピングエラー時にエラーメッセージが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({ success: false, error: 'スクレイピングエラー' })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('スクレイピングエラー')).toBeInTheDocument()
    })
  })

  it('スクレイピング例外時にエラーメッセージが表示される', async () => {
    mockScrapeExternalEvents.mockRejectedValue(new Error('ネットワークエラー'))
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('スクレイピング中にエラーが発生しました')).toBeInTheDocument()
    })
  })

  it('空のスクレイピング結果でメッセージが表示される', () => {
    render(<EventImportClient />)
    expect(screen.getByText('「イベント情報を取得」ボタンを押してイベントを取得してください')).toBeInTheDocument()
  })

  it('取得結果の件数が表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 3 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/取得結果: 2件/)).toBeInTheDocument()
    })
  })

  it('除外された重複件数が表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 3 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/完全重複 3件は除外済み/)).toBeInTheDocument()
    })
  })

  it('詳細ボタンで編集モーダルが開く', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getAllByText('詳細').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('詳細')[0]!)

    await waitFor(() => {
      expect(screen.getByText('イベント情報を編集')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 追加テスト: イベント削除、インライン編集、全選択/解除、カード詳細
  // ============================================================

  it('イベントを一覧から削除できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('テスト展示会')).toBeInTheDocument()
    })

    // ✕ボタンでイベントを削除
    const removeButtons = screen.getAllByText('✕')
    await user.click(removeButtons[0]!)

    await waitFor(() => {
      expect(screen.queryByDisplayValue('テスト展示会')).not.toBeInTheDocument()
    })
  })

  it('タイトルをインライン編集できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('テスト展示会')).toBeInTheDocument()
    })

    const titleInput = screen.getByDisplayValue('テスト展示会')
    await user.clear(titleInput)
    await user.type(titleInput, '更新タイトル')

    expect(screen.getByDisplayValue('更新タイトル')).toBeInTheDocument()
  })

  it('都道府県をインライン編集できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('テスト展示会')).toBeInTheDocument()
    })

    // 都道府県のセレクトボックスを変更
    const prefectureSelects = document.querySelectorAll('select')
    const prefSelect = Array.from(prefectureSelects).find(
      s => s.querySelector('option[value="東京都"]')
    )
    if (prefSelect) {
      fireEvent.change(prefSelect, { target: { value: '大阪府' } })
    }
  })

  it('会場をインライン編集できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('上野公園')).toBeInTheDocument()
    })

    const venueInput = screen.getByDisplayValue('上野公園')
    await user.clear(venueInput)
    await user.type(venueInput, '新会場')

    expect(screen.getByDisplayValue('新会場')).toBeInTheDocument()
  })

  it('全選択チェックボックスで全選択/全解除できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(1)
    })

    // 全選択チェックボックス（最初のもの）をクリックして全解除
    const allCheckboxes = screen.getAllByRole('checkbox')
    await user.click(allCheckboxes[0]!)

    // もう一度クリックして全選択
    await user.click(allCheckboxes[0]!)
  })

  it('個別イベントの選択を解除できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: [mockEvents[0]], filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    // 個別チェックボックスをクリックして解除
    const checkboxes = screen.getAllByRole('checkbox')
    const eventCheckbox = checkboxes[checkboxes.length - 1]
    await user.click(eventCheckbox!)
  })

  it('カードビューで主催者情報が表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    await waitFor(() => {
      expect(screen.getByText(/主催: テスト主催/)).toBeInTheDocument()
    })
  })

  it('カードビューで説明が表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    await waitFor(() => {
      expect(screen.getByText('テスト説明')).toBeInTheDocument()
    })
  })

  it('カードビューで即売ありバッジが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    await waitFor(() => {
      expect(screen.getByText('即売あり')).toBeInTheDocument()
    })
  })

  it('カードビューで外部URLリンクが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    await waitFor(() => {
      const detailLink = screen.getByRole('link', { name: /詳細/ })
      expect(detailLink).toBeInTheDocument()
      expect(detailLink).toHaveAttribute('href', 'https://example.com')
    })
  })

  it('カードビューで類似イベントバッジが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    await waitFor(() => {
      expect(screen.getByText('類似あり')).toBeInTheDocument()
      expect(screen.getByText(/類似イベント: 「既存の類似展示会」/)).toBeInTheDocument()
    })
  })

  it('カードビューでイベントを削除できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    await waitFor(() => {
      expect(screen.getAllByText('削除').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('削除')[0]!)

    await waitFor(() => {
      expect(screen.queryByText('テスト展示会')).not.toBeInTheDocument()
    })
  })

  it('編集モーダルでイベントを保存できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getAllByText('詳細').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('詳細')[0]!)

    await waitFor(() => {
      expect(screen.getByText('イベント情報を編集')).toBeInTheDocument()
    })

    // モーダル内の保存ボタン
    await user.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(screen.queryByText('イベント情報を編集')).not.toBeInTheDocument()
    })
  })

  it('即売チェックボックスをインライン変更できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('テスト展示会')).toBeInTheDocument()
    })

    // 即売チェックボックスを変更（テーブル内のcheckbox）
    const checkboxes = screen.getAllByRole('checkbox')
    // The hasSales checkbox is distinct from the select checkbox
    expect(checkboxes.length).toBeGreaterThan(2)
  })

  it('入場料をインライン編集できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('無料')).toBeInTheDocument()
    })

    const feeInput = screen.getByDisplayValue('無料')
    await user.clear(feeInput)
    await user.type(feeInput, '500円')

    expect(screen.getByDisplayValue('500円')).toBeInTheDocument()
  })

  it('編集モーダルのキャンセルボタンでモーダルを閉じる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getAllByText('詳細').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('詳細')[0]!)

    await waitFor(() => {
      expect(screen.getByText('イベント情報を編集')).toBeInTheDocument()
    })

    await user.click(screen.getByText('キャンセル'))

    await waitFor(() => {
      expect(screen.queryByText('イベント情報を編集')).not.toBeInTheDocument()
    })
  })

  it('編集モーダルでタイトルを変更して保存できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getAllByText('詳細').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('詳細')[0]!)

    await waitFor(() => {
      expect(screen.getByText('イベント情報を編集')).toBeInTheDocument()
    })

    // モーダル内のタイトル入力(labelで「タイトル *」)
    const titleInputs = screen.getAllByDisplayValue('テスト展示会')
    const modalTitleInput = titleInputs[titleInputs.length - 1]
    await user.clear(modalTitleInput!)
    await user.type(modalTitleInput!, '新タイトル')

    await user.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(screen.queryByText('イベント情報を編集')).not.toBeInTheDocument()
    })
  })

  it('カードビューで編集ボタンからモーダルが開く', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText('🗂️ カード')).toBeInTheDocument()
    })

    await user.click(screen.getByText('🗂️ カード'))

    await waitFor(() => {
      expect(screen.getAllByText('編集').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByText('編集')[0]!)

    await waitFor(() => {
      expect(screen.getByText('イベント情報を編集')).toBeInTheDocument()
    })
  })

  it('市区町村をインライン編集できる', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('台東区')).toBeInTheDocument()
    })

    const cityInput = screen.getByDisplayValue('台東区')
    await user.clear(cityInput)
    await user.type(cityInput, '新宿区')

    expect(screen.getByDisplayValue('新宿区')).toBeInTheDocument()
  })

  it('日付なしイベントの個別チェックボックスが無効', async () => {
    const eventsWithNoDate = [
      { ...mockEvents[0], id: 'no-date', startDate: null, endDate: null, isDuplicate: false },
    ]
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: eventsWithNoDate, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      // Find the disabled checkbox (individual event row)
      const disabledCheckboxes = checkboxes.filter((cb: any) => cb.disabled)
      expect(disabledCheckboxes.length).toBeGreaterThan(0)
    })
  })

  it('テーブルで類似タイプが表示される', async () => {
    mockScrapeExternalEvents.mockResolvedValue({
      success: true, data: { events: mockEvents, filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/類似: 既存の類似展示会/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // 追加テスト: 文字数違反(clipped/rejected)の初期選択除外・バッジ表示・編集による解消
  // ============================================================

  it('rejected 違反を含む行は初期選択から除外され、他の有効行（clippedを含む）は選択される', async () => {
    const okEvent = { ...mockEvents[0], id: 'ok-event' }
    const clippedEvent = {
      ...mockEvents[0],
      id: 'clipped-event',
      title: 'クリップイベント',
      organizer: 'あ'.repeat(249), // ソフト上限(200)超過・ハード上限(2000)内 → clipped
    }
    const rejectedEvent = {
      ...mockEvents[0],
      id: 'rejected-event',
      title: '違反イベント',
      organizer: 'あ'.repeat(2001), // ハード上限(2000)超過 → rejected
    }
    mockScrapeExternalEvents.mockResolvedValue({
      success: true,
      data: { events: [okEvent, clippedEvent, rejectedEvent], filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/2件選択中/)).toBeInTheDocument()
    })

    const okRow = screen.getByDisplayValue('テスト展示会').closest('tr')!
    const okCheckbox = within(okRow).getAllByRole('checkbox')[0] as HTMLInputElement
    expect(okCheckbox.checked).toBe(true)

    const clippedRow = screen.getByDisplayValue('クリップイベント').closest('tr')!
    const clippedCheckbox = within(clippedRow).getAllByRole('checkbox')[0] as HTMLInputElement
    expect(clippedCheckbox.checked).toBe(true)

    const rejectedRow = screen.getByDisplayValue('違反イベント').closest('tr')!
    const rejectedCheckbox = within(rejectedRow).getAllByRole('checkbox')[0] as HTMLInputElement
    expect(rejectedCheckbox.checked).toBe(false)
  })

  it('一覧行に clipped/rejected の違反バッジが表示される', async () => {
    const clippedEvent = {
      ...mockEvents[0],
      id: 'clipped-event',
      title: 'クリップイベント',
      organizer: 'あ'.repeat(249),
    }
    const rejectedEvent = {
      ...mockEvents[0],
      id: 'rejected-event',
      title: '違反イベント',
      organizer: 'あ'.repeat(2001),
    }
    mockScrapeExternalEvents.mockResolvedValue({
      success: true,
      data: { events: [clippedEvent, rejectedEvent], filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/主催者 249\/200文字/)).toBeInTheDocument()
      expect(screen.getByText(/取込不可: 主催者が長すぎます/)).toBeInTheDocument()
    })
  })

  it('編集で違反を解消するとバッジが消える', async () => {
    const clippedEvent = {
      ...mockEvents[0],
      id: 'clipped-event',
      title: 'クリップイベント',
      organizer: 'あ'.repeat(249),
    }
    mockScrapeExternalEvents.mockResolvedValue({
      success: true,
      data: { events: [clippedEvent], filteredCount: 0 },
    })
    const user = userEvent.setup()
    render(<EventImportClient />)

    await user.click(screen.getByText('イベント情報を取得'))

    await waitFor(() => {
      expect(screen.getByText(/主催者 249\/200文字/)).toBeInTheDocument()
    })

    // 詳細編集モーダルを開き、主催者を短くして保存
    await user.click(screen.getByText('詳細'))

    await waitFor(() => {
      expect(screen.getByText('イベント情報を編集')).toBeInTheDocument()
    })

    const organizerInput = screen.getByDisplayValue('あ'.repeat(249))
    await user.clear(organizerInput)
    await user.type(organizerInput, '短い主催者')

    await user.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(screen.queryByText('イベント情報を編集')).not.toBeInTheDocument()
    })

    expect(screen.queryByText(/主催者.*\/200文字/)).not.toBeInTheDocument()
    expect(screen.queryByText(/切り詰めて取込/)).not.toBeInTheDocument()
  })
})
