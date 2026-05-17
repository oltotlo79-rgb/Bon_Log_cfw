/**
 * ルート 404 ページ (app/not-found.tsx) のテスト
 */
import { render, screen } from '@testing-library/react'
import NotFound from '@/app/not-found'

describe('Root NotFound', () => {
  it('ページが見つかりませんの見出しを表示する', () => {
    render(<NotFound />)
    expect(screen.getByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument()
  })

  it('トップへリンクを表示する', () => {
    render(<NotFound />)
    const topLink = screen.getByRole('link', { name: 'トップへ' })
    expect(topLink).toBeInTheDocument()
    expect(topLink).toHaveAttribute('href', '/')
  })

  it('タイムラインへリンクを表示する', () => {
    render(<NotFound />)
    const feedLink = screen.getByRole('link', { name: 'タイムラインへ' })
    expect(feedLink).toBeInTheDocument()
    expect(feedLink).toHaveAttribute('href', '/feed')
  })
})
