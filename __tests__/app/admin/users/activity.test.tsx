/**
 * app/admin/users/[id]/activity/page.tsx
 *
 * 既存の admin-pages-branches.test.tsx は Page() の戻り値を render() せず、
 * `expect(result).toBeDefined()` のみで検証していたため、ActivityIcon /
 * getActivityColor の switch 分岐（各 activity.type ごとの分岐）が実際には
 * 実行されていなかった（React 要素のインスタンス化のみで、コンポーネント本体は
 * 実 DOM レンダリング時まで評価されないため）。
 * ここでは実際に render() して各タイプのアイコン・ラベルが描画されることを検証する。
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetAdminUserDetail = vi.fn()
vi.mock('@/lib/actions/admin/users', () => ({
  getAdminUserDetail: (...args: unknown[]) => mockGetAdminUserDetail(...args),
}))

const mockGetUserActivity = vi.fn()
const mockDetectSuspiciousBehavior = vi.fn()
vi.mock('@/lib/actions/admin/activity', () => ({
  getUserActivity: (...args: unknown[]) => mockGetUserActivity(...args),
  detectSuspiciousBehavior: (...args: unknown[]) => mockDetectSuspiciousBehavior(...args),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}))

import AdminUserActivityPage from '@/app/admin/users/[id]/activity/page'

function buildActivity(type: string, id: string) {
  return { type, id, description: `${type}のアクティビティ`, createdAt: new Date('2026-01-01T00:00:00Z') }
}

describe('AdminUserActivityPage - ActivityIcon/getActivityColor 分岐の実描画検証', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminUserDetail.mockResolvedValue({
      user: { id: 'u1', nickname: 'テストユーザー', email: 'test@example.com', avatarUrl: null, isSuspended: false },
    })
    mockDetectSuspiciousBehavior.mockResolvedValue({ flags: [], isSuspicious: false })
  })

  it('post/comment/like/follow/loginの各タイプで対応するラベルが描画される', async () => {
    mockGetUserActivity.mockResolvedValue({
      activities: [
        buildActivity('post', 'p1'),
        buildActivity('comment', 'c1'),
        buildActivity('like', 'l1'),
        buildActivity('follow', 'f1'),
        buildActivity('login', 'lg1'),
      ],
    })

    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    render(result)

    expect(screen.getByText('投稿')).toBeInTheDocument()
    expect(screen.getByText('コメント')).toBeInTheDocument()
    expect(screen.getByText('いいね')).toBeInTheDocument()
    expect(screen.getByText('フォロー')).toBeInTheDocument()
    expect(screen.getByText('ログイン')).toBeInTheDocument()
    expect(screen.getByText('postのアクティビティ')).toBeInTheDocument()
  })

  it('未知のtypeの場合はActivityIcon/getActivityColorのdefaultケースにフォールバックする', async () => {
    mockGetUserActivity.mockResolvedValue({
      activities: [buildActivity('unknown_type', 'x1')],
    })

    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    render(result)

    // switch の default にフォールしても例外なく描画され、ラベルは「ログイン」になる
    // （activity.type === 'post'/'comment'/'like'/'follow' のいずれにも一致しないため）
    expect(screen.getByText('unknown_typeのアクティビティ')).toBeInTheDocument()
    expect(screen.getByText('ログイン')).toBeInTheDocument()
  })

  it('不審行動フラグがある場合はアラートを描画する', async () => {
    mockGetUserActivity.mockResolvedValue({ activities: [] })
    mockDetectSuspiciousBehavior.mockResolvedValue({
      isSuspicious: true,
      flags: [{ type: 'mass_likes', value: 500, threshold: 100 }],
    })

    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    render(result)

    expect(screen.getByText('不審行動を検知')).toBeInTheDocument()
    expect(screen.getByText(/大量いいね/)).toBeInTheDocument()
  })

  it('アクティビティが0件の場合は空状態メッセージを表示する', async () => {
    mockGetUserActivity.mockResolvedValue({ activities: [] })

    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    render(result)

    expect(screen.getByText('アクティビティがありません')).toBeInTheDocument()
  })
})
