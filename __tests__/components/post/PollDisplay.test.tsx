import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PollDisplay } from '@/components/post/PollDisplay'

vi.mock('@/lib/actions/poll', () => ({
  votePoll: vi.fn(),
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn().mockReturnValue('1日'),
}))

vi.mock('date-fns/locale', () => ({
  ja: {},
}))

import { votePoll } from '@/lib/actions/poll'
const mockVotePoll = votePoll as ReturnType<typeof vi.fn>

const basePoll = {
  id: 'poll-1',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  options: [
    { id: 'opt-1', text: '黒松', _count: { votes: 5 } },
    { id: 'opt-2', text: '五葉松', _count: { votes: 3 } },
    { id: 'opt-3', text: 'もみじ', _count: { votes: 2 } },
  ],
  votes: [],
  _count: { votes: 10 },
}

describe('PollDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 投票UI表示
  it('未投票ユーザーには投票ボタンが表示される', () => {
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    expect(screen.getByText('投票する')).toBeInTheDocument()
  })

  it('選択肢のテキストが表示される', () => {
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    expect(screen.getByText('黒松')).toBeInTheDocument()
    expect(screen.getByText('五葉松')).toBeInTheDocument()
    expect(screen.getByText('もみじ')).toBeInTheDocument()
  })

  it('総投票数が表示される', () => {
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    expect(screen.getByText('10票')).toBeInTheDocument()
  })

  it('残り時間が表示される', () => {
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    expect(screen.getByText(/残り/)).toBeInTheDocument()
  })

  it('選択肢を選ばないと投票ボタンがdisabled', () => {
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    const button = screen.getByText('投票する')
    expect(button).toBeDisabled()
  })

  it('選択肢をクリックすると選択状態になる', async () => {
    const user = userEvent.setup()
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    await user.click(screen.getByText('黒松'))
    const voteBtn = screen.getByText('投票する')
    expect(voteBtn).not.toBeDisabled()
  })

  it('別の選択肢をクリックすると選択が切り替わる', async () => {
    const user = userEvent.setup()
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    await user.click(screen.getByText('黒松'))
    await user.click(screen.getByText('五葉松'))
    // 投票ボタンはまだ有効
    expect(screen.getByText('投票する')).not.toBeDisabled()
  })

  it('投票するとvotePollが呼ばれる', async () => {
    mockVotePoll.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    await user.click(screen.getByText('黒松'))
    await user.click(screen.getByText('投票する'))
    await waitFor(() => {
      expect(mockVotePoll).toHaveBeenCalledWith('poll-1', 'opt-1')
    })
  })

  // 結果表示
  it('投票済みユーザーには結果が表示される', () => {
    const poll = {
      ...basePoll,
      votes: [{ userId: 'user-1', optionId: 'opt-1' }],
    }
    render(<PollDisplay poll={poll} currentUserId="user-1" />)
    expect(screen.queryByText('投票する')).not.toBeInTheDocument()
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })

  it('投票済みの選択肢にチェックマークが表示される', () => {
    const poll = {
      ...basePoll,
      votes: [{ userId: 'user-1', optionId: 'opt-1' }],
    }
    render(<PollDisplay poll={poll} currentUserId="user-1" />)
    expect(screen.getByText(/黒松/)).toHaveTextContent('✓')
  })

  it('未認証ユーザーには結果が表示される', () => {
    render(<PollDisplay poll={basePoll} />)
    expect(screen.queryByText('投票する')).not.toBeInTheDocument()
  })

  // 期限切れ
  it('期限切れアンケートでは結果が表示される', () => {
    const expiredPoll = {
      ...basePoll,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    }
    render(<PollDisplay poll={expiredPoll} currentUserId="user-1" />)
    expect(screen.queryByText('投票する')).not.toBeInTheDocument()
    expect(screen.getByText('終了済み')).toBeInTheDocument()
  })

  it('期限切れではパーセンテージが表示される', () => {
    const expiredPoll = {
      ...basePoll,
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    }
    render(<PollDisplay poll={expiredPoll} currentUserId="user-1" />)
    expect(screen.getByText(/50%/)).toBeInTheDocument()
    expect(screen.getByText(/30%/)).toBeInTheDocument()
    expect(screen.getByText(/20%/)).toBeInTheDocument()
  })

  // 0票のケース
  it('0票の場合パーセンテージが0%', () => {
    const zeroPoll = {
      ...basePoll,
      options: [
        { id: 'opt-1', text: '黒松', _count: { votes: 0 } },
        { id: 'opt-2', text: '五葉松', _count: { votes: 0 } },
      ],
      _count: { votes: 0 },
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    }
    render(<PollDisplay poll={zeroPoll} currentUserId="user-1" />)
    const percentages = screen.getAllByText('0%')
    expect(percentages.length).toBe(2)
  })

  it('0票の場合は0票と表示', () => {
    const zeroPoll = {
      ...basePoll,
      _count: { votes: 0 },
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    }
    render(<PollDisplay poll={zeroPoll} currentUserId="user-1" />)
    expect(screen.getByText('0票')).toBeInTheDocument()
  })

  // イベント伝搬
  it('クリックイベントが親要素に伝搬しない', async () => {
    const parentClick = vi.fn()
    const user = userEvent.setup()
    render(
      <div onClick={parentClick}>
        <PollDisplay poll={basePoll} currentUserId="user-1" />
      </div>
    )
    await user.click(screen.getByText('黒松'))
    expect(parentClick).not.toHaveBeenCalled()
  })

  // 投票成功後の状態更新
  it('投票成功後に結果表示に切り替わる', async () => {
    mockVotePoll.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    await user.click(screen.getByText('黒松'))
    await user.click(screen.getByText('投票する'))
    await waitFor(() => {
      expect(screen.queryByText('投票する')).not.toBeInTheDocument()
    })
  })

  it('投票成功後に投票数が1増える', async () => {
    mockVotePoll.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    await user.click(screen.getByText('黒松'))
    await user.click(screen.getByText('投票する'))
    await waitFor(() => {
      expect(screen.getByText('11票')).toBeInTheDocument()
    })
  })

  // 2つの選択肢しかない場合
  it('2つの選択肢のアンケートを正しく表示', () => {
    const twoPoll = {
      ...basePoll,
      options: [
        { id: 'opt-1', text: 'はい', _count: { votes: 7 } },
        { id: 'opt-2', text: 'いいえ', _count: { votes: 3 } },
      ],
    }
    render(<PollDisplay poll={twoPoll} currentUserId="user-1" />)
    expect(screen.getByText('はい')).toBeInTheDocument()
    expect(screen.getByText('いいえ')).toBeInTheDocument()
  })

  // 投票失敗時
  it('votePollがエラーを返しても投票UIが残る', async () => {
    mockVotePoll.mockResolvedValueOnce({ error: 'エラー' })
    const user = userEvent.setup()
    render(<PollDisplay poll={basePoll} currentUserId="user-1" />)
    await user.click(screen.getByText('黒松'))
    await user.click(screen.getByText('投票する'))
    await waitFor(() => {
      // 投票UIがまだ表示されている（結果に切り替わらない）
      expect(screen.getByText('投票する')).toBeInTheDocument()
    })
  })

  // 大きい投票数
  it('大きい投票数が正しく表示される', () => {
    const bigPoll = {
      ...basePoll,
      _count: { votes: 999999 },
      expiresAt: new Date(Date.now() - 1).toISOString(),
    }
    render(<PollDisplay poll={bigPoll} currentUserId="user-1" />)
    expect(screen.getByText('999999票')).toBeInTheDocument()
  })

  // 4つの選択肢
  it('4つの選択肢のアンケートを正しく表示', () => {
    const fourPoll = {
      ...basePoll,
      options: [
        { id: 'opt-1', text: 'A', _count: { votes: 1 } },
        { id: 'opt-2', text: 'B', _count: { votes: 2 } },
        { id: 'opt-3', text: 'C', _count: { votes: 3 } },
        { id: 'opt-4', text: 'D', _count: { votes: 4 } },
      ],
      _count: { votes: 10 },
    }
    render(<PollDisplay poll={fourPoll} currentUserId="user-1" />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })
})
