import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('Not Found pages', () => {
  it('BonsaiNotFound: 盆栽が見つからないメッセージとリンクを表示する', async () => {
    const { default: BonsaiNotFound } = await import('@/app/(main)/bonsai/[id]/not-found')
    render(<BonsaiNotFound />)
    expect(screen.getByText('盆栽が見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '盆栽一覧に戻る' })).toHaveAttribute('href', '/bonsai')
  })

  it('EventNotFound: イベントが見つからないメッセージとリンクを表示する', async () => {
    const { default: EventNotFound } = await import('@/app/(main)/events/[id]/not-found')
    render(<EventNotFound />)
    expect(screen.getByText('イベントが見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'イベント一覧に戻る' })).toHaveAttribute('href', '/events')
  })

  it('ShopNotFound: 盆栽園が見つからないメッセージとリンクを表示する', async () => {
    const { default: ShopNotFound } = await import('@/app/(main)/shops/[id]/not-found')
    render(<ShopNotFound />)
    expect(screen.getByText('盆栽園が見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '盆栽園マップに戻る' })).toHaveAttribute('href', '/shops')
  })

  it('UserNotFound: ユーザーが見つからないメッセージとリンクを表示する', async () => {
    const { default: UserNotFound } = await import('@/app/(main)/users/[id]/not-found')
    render(<UserNotFound />)
    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'タイムラインに戻る' })).toHaveAttribute('href', '/feed')
  })
})
