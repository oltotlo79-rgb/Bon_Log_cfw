import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { RepostButton } from '@/components/post/RepostButton'

vi.mock('@/lib/actions/post', () => ({
  createRepost: vi.fn().mockResolvedValue({ success: true, data: { reposted: true } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
// 引用モーダルは別テストで検証するため軽量化
vi.mock('@/components/post/QuotePostModal', () => ({
  QuotePostModal: () => null,
}))

const quoteTarget = { id: 'post-1', content: '本文', user: { nickname: '山田' } }

describe('RepostButton', () => {
  beforeEach(() => vi.clearAllMocks())

  it('リポスト数が正のときに件数を表示する', () => {
    render(<RepostButton postId="post-1" quoteTarget={quoteTarget} initialCount={3} />)
    const btn = screen.getByRole('button', { name: 'リポスト' })
    expect(btn).toHaveTextContent('3')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('件数が0のときは数字を表示しない', () => {
    render(<RepostButton postId="post-1" quoteTarget={quoteTarget} initialCount={0} />)
    expect(screen.getByRole('button', { name: 'リポスト' })).not.toHaveTextContent('0')
  })

  it('リポスト済みのとき aria-pressed が true になる', () => {
    render(
      <RepostButton postId="post-1" quoteTarget={quoteTarget} initialReposted initialCount={1} />,
    )
    expect(screen.getByRole('button', { name: 'リポスト' })).toHaveAttribute('aria-pressed', 'true')
  })
})
