import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '../../utils/test-utils'
import { RepostButton } from '@/components/post/RepostButton'
import {
  MSG_ERROR_TITLE,
  MSG_REPOST_DONE,
  MSG_REPOST_UNDONE,
  MSG_REPOST_FAILED,
} from '@/lib/constants/messages'

/**
 * Radix DropdownMenu はポインタイベントの実装が jsdom で不安定なため、
 * メニュー項目クリックの検証に必要な最小限の DOM 構造に差し替える。
 * トリガー(アイコンボタン)とメニュー項目は同じテキスト「リポスト」を持ちうるため、
 * data-testid で領域を分離し within() で問い合わせを限定する。
 * (RepostButton 自体のロジックはモックしない)
 */
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="repost-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="repost-menu">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}))

function getTrigger() {
  return within(screen.getByTestId('repost-trigger')).getByRole('button')
}

function clickMenuItem(name: string) {
  fireEvent.click(within(screen.getByTestId('repost-menu')).getByRole('button', { name }))
}

const mockCreateRepost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  createRepost: (...args: unknown[]) => mockCreateRepost(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  }
})

let capturedQuoteOpen: boolean | undefined
vi.mock('@/components/post/QuotePostModal', () => ({
  QuotePostModal: ({ open }: { open: boolean }) => {
    capturedQuoteOpen = open
    return open ? <div data-testid="quote-modal-open" /> : null
  },
}))

const quoteTarget = { id: 'post-1', content: '本文', user: { nickname: '山田' } }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('RepostButton - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedQuoteOpen = undefined
  })

  it('未リポスト状態で「リポスト」をクリックすると createRepost が呼ばれ、成功時に件数が増えトーストが表示される', async () => {
    mockCreateRepost.mockResolvedValue({ success: true, data: { reposted: true } })
    render(<RepostButton postId="post-1" quoteTarget={quoteTarget} initialCount={0} />)

    clickMenuItem('リポスト')

    await waitFor(() => {
      expect(mockCreateRepost).toHaveBeenCalledWith('post-1')
    })
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ description: MSG_REPOST_DONE })
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['timeline'] })
    await waitFor(() => {
      expect(getTrigger()).toHaveTextContent('1')
    })
  })

  it('リポスト済み状態で「リポストを取り消す」をクリックすると解除され件数が減りトーストが表示される', async () => {
    mockCreateRepost.mockResolvedValue({ success: true, data: { reposted: false } })
    render(
      <RepostButton postId="post-1" quoteTarget={quoteTarget} initialReposted initialCount={1} />,
    )

    clickMenuItem('リポストを取り消す')

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ description: MSG_REPOST_UNDONE })
    })
    await waitFor(() => {
      const btn = getTrigger()
      expect(btn).toHaveAttribute('aria-pressed', 'false')
      expect(btn).not.toHaveTextContent('1')
    })
  })

  it('createRepost が失敗した場合、楽観的更新をロールバックしエラートーストを表示する', async () => {
    mockCreateRepost.mockResolvedValue({ success: false, error: 'error' })
    render(<RepostButton postId="post-1" quoteTarget={quoteTarget} initialCount={2} />)

    clickMenuItem('リポスト')

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: MSG_ERROR_TITLE,
        description: MSG_REPOST_FAILED,
        variant: 'destructive',
      })
    })
    // ロールバック: 元の count=2, reposted=false に戻る
    await waitFor(() => {
      const btn = getTrigger()
      expect(btn).toHaveAttribute('aria-pressed', 'false')
      expect(btn).toHaveTextContent('2')
    })
  })

  it('サーバーが返す reposted 値が楽観的値と異なる場合はサーバー値を採用する', async () => {
    // optimistic には true になるはずだが、サーバーは false を返す (競合状態を想定)
    mockCreateRepost.mockResolvedValue({ success: true, data: { reposted: false } })
    render(<RepostButton postId="post-1" quoteTarget={quoteTarget} initialCount={0} />)

    clickMenuItem('リポスト')

    await waitFor(() => {
      expect(getTrigger()).toHaveAttribute('aria-pressed', 'false')
    })
    expect(mockToast).toHaveBeenCalledWith({ description: MSG_REPOST_UNDONE })
  })

  it('「引用」をクリックすると QuotePostModal に open=true が渡される', () => {
    render(<RepostButton postId="post-1" quoteTarget={quoteTarget} />)

    expect(capturedQuoteOpen).toBe(false)

    clickMenuItem('引用')

    expect(capturedQuoteOpen).toBe(true)
    expect(screen.getByTestId('quote-modal-open')).toBeInTheDocument()
  })

  it('リクエスト中はリポストボタンが disabled になる', async () => {
    const { promise, resolve } = deferred<{ success: boolean; data?: { reposted: boolean } }>()
    mockCreateRepost.mockReturnValue(promise)

    render(<RepostButton postId="post-1" quoteTarget={quoteTarget} initialCount={0} />)

    clickMenuItem('リポスト')

    await waitFor(() => {
      expect(getTrigger()).toBeDisabled()
    })

    resolve({ success: true, data: { reposted: true } })

    await waitFor(() => {
      expect(getTrigger()).not.toBeDisabled()
    })
  })
})
