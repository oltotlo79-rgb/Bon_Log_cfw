import { vi } from 'vitest'
/**
 * HiddenContentList コンポーネントのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { HiddenContentList } from '@/app/admin/hidden/HiddenContentList'

// モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

vi.mock('@/lib/actions/admin/hidden', () => ({
  restoreContent: vi.fn().mockResolvedValue({ success: true }),
  deleteHiddenContent: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/constants/report', () => ({
  CONTENT_TYPE_LABELS: {
    post: '投稿',
    comment: 'コメント',
    event: 'イベント',
    shop: '盆栽園',
    review: 'レビュー',
  },
  CONTENT_TYPE_COLORS: {
    post: 'bg-blue-100 text-blue-800',
    comment: 'bg-green-100 text-green-800',
    event: 'bg-purple-100 text-purple-800',
    shop: 'bg-amber-100 text-amber-800',
    review: 'bg-pink-100 text-pink-800',
  },
}))

import { restoreContent, deleteHiddenContent } from '@/lib/actions/admin/hidden'

const mockRestore = restoreContent as ReturnType<typeof vi.fn>
const mockDelete = deleteHiddenContent as ReturnType<typeof vi.fn>

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'post' as const,
    id: 'item-1',
    content: 'テストコンテンツ',
    createdBy: { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null },
    hiddenAt: new Date('2024-06-01'),
    reportCount: 5,
    ...overrides,
  }
}

const mixedItems = [
  createItem({ type: 'post', id: 'p1', content: '投稿コンテンツ' }),
  createItem({ type: 'comment', id: 'c1', content: 'コメントコンテンツ' }),
  createItem({ type: 'event', id: 'e1', content: 'イベントコンテンツ' }),
  createItem({ type: 'shop', id: 's1', content: '盆栽園コンテンツ' }),
  createItem({ type: 'review', id: 'r1', content: 'レビューコンテンツ' }),
]

describe('HiddenContentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = vi.fn().mockReturnValue(true)
  })

  it('非表示アイテム一覧を表示する', () => {
    render(<HiddenContentList items={[createItem()]} />)
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument()
  })

  it('アイテムがない場合に空の状態を表示する', () => {
    render(<HiddenContentList items={[]} />)
    expect(screen.getByText('該当するコンテンツはありません')).toBeInTheDocument()
  })

  it('フィルターボタンが表示される', () => {
    render(<HiddenContentList items={mixedItems} />)
    expect(screen.getByText(/すべて/)).toBeInTheDocument()
    const postButtons = screen.getAllByText(/投稿/)
    expect(postButtons.length).toBeGreaterThan(0)
    const commentButtons = screen.getAllByText(/コメント/)
    expect(commentButtons.length).toBeGreaterThan(0)
  })

  it('投稿でフィルタリングすると投稿のみ表示される', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={mixedItems} />)

    const postFilters = screen.getAllByText(/投稿/)
    await user.click(postFilters[0])

    expect(screen.getByText('投稿コンテンツ')).toBeInTheDocument()
    expect(screen.queryByText('コメントコンテンツ')).not.toBeInTheDocument()
  })

  it('コメントでフィルタリングするとコメントのみ表示される', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={mixedItems} />)

    const commentFilters = screen.getAllByText(/コメント/)
    await user.click(commentFilters[0])

    expect(screen.getByText('コメントコンテンツ')).toBeInTheDocument()
    expect(screen.queryByText('投稿コンテンツ')).not.toBeInTheDocument()
  })

  it('すべてフィルターですべてのアイテムを表示する', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={mixedItems} />)

    // まず投稿フィルター
    await user.click(screen.getAllByText(/投稿/)[0])
    expect(screen.queryByText('コメントコンテンツ')).not.toBeInTheDocument()

    // すべてに戻す
    await user.click(screen.getByText(/すべて/))
    expect(screen.getByText('投稿コンテンツ')).toBeInTheDocument()
    expect(screen.getByText('コメントコンテンツ')).toBeInTheDocument()
  })

  it('タイプバッジが正しいラベルで表示される', () => {
    render(<HiddenContentList items={[createItem({ type: 'post' })]} />)
    // バッジのラベルとフィルターボタン両方に「投稿」があるので、複数ヒット可
    const badges = screen.getAllByText('投稿', { exact: false })
    expect(badges.length).toBeGreaterThan(0)
  })

  it('通報数を表示する', () => {
    render(<HiddenContentList items={[createItem({ reportCount: 15 })]} />)
    expect(screen.getByText('通報数: 15件')).toBeInTheDocument()
  })

  it('非表示日時を表示する', () => {
    render(<HiddenContentList items={[createItem({ hiddenAt: new Date('2024-06-01') })]} />)
    const dateTexts = screen.getAllByText(/2024/)
    expect(dateTexts.length).toBeGreaterThan(0)
  })

  it('作成者情報を表示する', () => {
    render(<HiddenContentList items={[createItem()]} />)
    expect(screen.getByText(/テストユーザー/)).toBeInTheDocument()
  })

  it('再表示ボタンが存在する', () => {
    render(<HiddenContentList items={[createItem()]} />)
    expect(screen.getByText('再表示')).toBeInTheDocument()
  })

  it('再表示ボタンをクリックすると確認ダイアログが表示される', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('再表示'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
  })

  it('再表示を確認するとサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem({ type: 'post', id: 'p1' })]} />)
    await user.click(screen.getByText('再表示'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '再表示する' }))
    await waitFor(() => { expect(mockRestore).toHaveBeenCalledWith('post', 'p1') })
  })

  it('再表示をキャンセルするとサーバーアクションが呼ばれない', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('再表示'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockRestore).not.toHaveBeenCalled()
  })

  it('削除ボタンが存在する', () => {
    render(<HiddenContentList items={[createItem()]} />)
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  it('削除ボタンをクリックすると確認ダイアログが表示される', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('削除'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
  })

  it('削除を確認するとサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem({ type: 'comment', id: 'c1' })]} />)
    await user.click(screen.getByText('削除'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => { expect(mockDelete).toHaveBeenCalledWith('comment', 'c1') })
  })

  it('削除をキャンセルするとサーバーアクションが呼ばれない', async () => {
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('削除'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('処理中は再表示ボタンが無効になる', async () => {
    let resolvePromise: (v: { success: boolean }) => void
    mockRestore.mockImplementation(() => new Promise(r => { resolvePromise = r }))

    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('再表示'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '再表示する' }))

    // 処理中テキストが表示される
    await waitFor(() => {
      expect(screen.getAllByText('処理中...').length).toBeGreaterThan(0)
    })

    resolvePromise!({ success: true })
    await waitFor(() => {
      expect(screen.getByText('再表示')).toBeInTheDocument()
    })
  })

  it('処理中は削除ボタンが無効になる', async () => {
    let resolvePromise: (v: { success: boolean }) => void
    mockDelete.mockImplementation(() => new Promise(r => { resolvePromise = r }))

    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('削除'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(screen.getAllByText('処理中...').length).toBeGreaterThan(0)
    })

    resolvePromise!({ success: true })
    await waitFor(() => {
      expect(screen.getByText('削除')).toBeInTheDocument()
    })
  })

  it('再表示エラー時にトーストが表示される', async () => {
    mockRestore.mockResolvedValueOnce({ error: '再表示に失敗しました' } as { error: string })
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('再表示'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '再表示する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '再表示に失敗しました', variant: 'destructive' }))
    })
  })

  it('削除エラー時にトーストが表示される', async () => {
    mockDelete.mockResolvedValueOnce({ error: '削除に失敗しました' } as { error: string })
    const user = userEvent.setup()
    render(<HiddenContentList items={[createItem()]} />)
    await user.click(screen.getByText('削除'))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' }))
    })
  })

  it('コンテンツがnullの場合は(内容なし)と表示する', () => {
    render(<HiddenContentList items={[createItem({ content: null })]} />)
    expect(screen.getByText('(内容なし)')).toBeInTheDocument()
  })

  it('hiddenAtがnullの場合は不明と表示する', () => {
    render(<HiddenContentList items={[createItem({ hiddenAt: null })]} />)
    expect(screen.getByText(/不明/)).toBeInTheDocument()
  })

  it('カウント0のタイプはフィルターボタンに表示されない', () => {
    const items = [createItem({ type: 'post', id: 'p1' })]
    render(<HiddenContentList items={items} />)
    // 投稿フィルターはあるが、コメントフィルターはない
    expect(screen.queryByText(/コメント \(/)).not.toBeInTheDocument()
  })
})
