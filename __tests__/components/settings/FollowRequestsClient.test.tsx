import { vi } from 'vitest'
/**
 * フォローリクエスト管理クライアントコンポーネントのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { FollowRequestsClient } from '@/app/(main)/settings/follow-requests/FollowRequestsClient'

// モックのセットアップ
const mockApproveFollowRequest = vi.fn()
const mockRejectFollowRequest = vi.fn()
const mockCancelFollowRequest = vi.fn()
vi.mock('@/lib/actions/follow-request', () => ({
  approveFollowRequest: (...args: unknown[]) => mockApproveFollowRequest(...args),
  rejectFollowRequest: (...args: unknown[]) => mockRejectFollowRequest(...args),
  cancelFollowRequest: (...args: unknown[]) => mockCancelFollowRequest(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}))

vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})

describe('FollowRequestsClient', () => {
  const receivedRequests = [
    {
      id: 'req-1',
      user: {
        id: 'user-1',
        nickname: 'テストユーザー1',
        avatarUrl: '/avatar1.jpg',
        bio: '盆栽が好きです',
      },
      createdAt: new Date('2025-01-15'),
    },
    {
      id: 'req-2',
      user: {
        id: 'user-2',
        nickname: 'テストユーザー2',
        avatarUrl: null,
        bio: null,
      },
      createdAt: new Date('2025-01-20'),
    },
  ]

  const sentRequests = [
    {
      id: 'req-3',
      user: {
        id: 'user-3',
        nickname: '送信先ユーザー',
        avatarUrl: '/avatar3.jpg',
        bio: '松柏類が専門です',
      },
      createdAt: new Date('2025-01-10'),
    },
  ]

  const defaultProps = {
    initialReceivedRequests: receivedRequests,
    initialSentRequests: sentRequests,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApproveFollowRequest.mockResolvedValue({ success: true })
    mockRejectFollowRequest.mockResolvedValue({ success: true })
    mockCancelFollowRequest.mockResolvedValue({ success: true })
  })

  // 1
  it('受信したリクエストタブを表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText(/受信したリクエスト/i)).toBeInTheDocument()
  })

  // 2
  it('送信したリクエストタブを表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText(/送信したリクエスト/i)).toBeInTheDocument()
  })

  // 3
  it('受信リクエストのユーザー情報を表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText('テストユーザー1')).toBeInTheDocument()
  })

  // 4
  it('送信リクエストのユーザー情報を表示する', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    await user.click(screen.getByText(/送信したリクエスト/i))
    expect(screen.getByText('送信先ユーザー')).toBeInTheDocument()
  })

  // 5
  it('タブ切り替えが動作する', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)

    // 初期は受信タブ
    expect(screen.getByText('テストユーザー1')).toBeInTheDocument()

    // 送信タブに切り替え
    await user.click(screen.getByText(/送信したリクエスト/i))
    expect(screen.getByText('送信先ユーザー')).toBeInTheDocument()
  })

  // 6
  it('承認ボタンクリックでapproveFollowRequestが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    const approveButtons = screen.getAllByText('承認')
    await user.click(approveButtons[0])

    await waitFor(() => {
      expect(mockApproveFollowRequest).toHaveBeenCalledWith('req-1')
    })
  })

  // 7
  it('拒否ボタンクリックでrejectFollowRequestが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    const rejectButtons = screen.getAllByText('拒否')
    await user.click(rejectButtons[0])

    await waitFor(() => {
      expect(mockRejectFollowRequest).toHaveBeenCalledWith('req-1')
    })
  })

  // 8
  it('キャンセルボタンクリックでcancelFollowRequestが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    await user.click(screen.getByText(/送信したリクエスト/i))
    await user.click(screen.getByText('キャンセル'))

    await waitFor(() => {
      expect(mockCancelFollowRequest).toHaveBeenCalledWith('user-3')
    })
  })

  // 9
  it('承認成功でトースト通知を表示する', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    await user.click(screen.getAllByText('承認')[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: '承認しました',
      }))
    })
  })

  // 10
  it('エラー時にエラートーストを表示する', async () => {
    mockApproveFollowRequest.mockResolvedValue({ error: '承認に失敗しました' })
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    await user.click(screen.getAllByText('承認')[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
      }))
    })
  })

  // 11
  it('承認後にリクエストがリストから削除される', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText('テストユーザー1')).toBeInTheDocument()

    await user.click(screen.getAllByText('承認')[0])

    await waitFor(() => {
      expect(screen.queryByText('テストユーザー1')).not.toBeInTheDocument()
    })
  })

  // 12
  it('拒否後にリクエストがリストから削除される', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText('テストユーザー1')).toBeInTheDocument()

    await user.click(screen.getAllByText('拒否')[0])

    await waitFor(() => {
      expect(screen.queryByText('テストユーザー1')).not.toBeInTheDocument()
    })
  })

  // 13
  it('キャンセル後にリクエストがリストから削除される', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    await user.click(screen.getByText(/送信したリクエスト/i))
    expect(screen.getByText('送信先ユーザー')).toBeInTheDocument()

    await user.click(screen.getByText('キャンセル'))

    await waitFor(() => {
      expect(screen.queryByText('送信先ユーザー')).not.toBeInTheDocument()
    })
  })

  // 14
  it('受信リストが空の場合にメッセージを表示する', () => {
    render(<FollowRequestsClient initialReceivedRequests={[]} initialSentRequests={sentRequests} />)
    expect(screen.getByText(/フォローリクエストはありません/i)).toBeInTheDocument()
  })

  // 15
  it('送信リストが空の場合にメッセージを表示する', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient initialReceivedRequests={receivedRequests} initialSentRequests={[]} />)
    await user.click(screen.getByText(/送信したリクエスト/i))
    expect(screen.getByText(/送信中のフォローリクエストはありません/i)).toBeInTheDocument()
  })

  // 16
  it('アバター画像を表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    const img = screen.getByAltText('テストユーザー1')
    expect(img).toBeInTheDocument()
  })

  // 17
  it('ニックネームを表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText('テストユーザー1')).toBeInTheDocument()
    expect(screen.getByText('テストユーザー2')).toBeInTheDocument()
  })

  // 18
  it('自己紹介を表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText('盆栽が好きです')).toBeInTheDocument()
  })

  // 19
  it('リクエスト日時を表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    const dateElements = screen.getAllByText(/2025/)
    expect(dateElements.length).toBeGreaterThan(0)
  })

  // 20
  it('アクション後にrouter.refreshが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<FollowRequestsClient {...defaultProps} />)
    await user.click(screen.getAllByText('承認')[0])

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // 21
  it('受信リクエスト数のバッジを表示する', () => {
    render(<FollowRequestsClient {...defaultProps} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
