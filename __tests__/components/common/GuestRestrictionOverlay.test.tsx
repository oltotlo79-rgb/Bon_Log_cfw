import React from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GuestRestrictionOverlay } from '@/components/common/GuestRestrictionOverlay'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('GuestRestrictionOverlay', () => {
  it('ゲストでない場合は子要素をそのまま表示する', () => {
    render(
      <GuestRestrictionOverlay isGuest={false} contentName="病害虫・農薬検索">
        <div data-testid="child">コンテンツ</div>
      </GuestRestrictionOverlay>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('コンテンツ')).toBeInTheDocument()
    expect(screen.queryByText(/新規登録後にご利用いただけます/)).not.toBeInTheDocument()
  })

  it('ゲストの場合はオーバーレイとメッセージを表示する', () => {
    render(
      <GuestRestrictionOverlay isGuest contentName="病害虫・農薬検索">
        <div data-testid="child">背面コンテンツ</div>
      </GuestRestrictionOverlay>
    )
    expect(screen.getByText('病害虫・農薬検索は新規登録後にご利用いただけます。')).toBeInTheDocument()
    expect(screen.getByText(/会員登録（無料）すると/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /無料で新規登録/ })).toHaveAttribute('href', '/register')
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('contentName が盆栽園マップの場合はその文言を表示する', () => {
    render(
      <GuestRestrictionOverlay isGuest contentName="盆栽園マップ">
        <div>子</div>
      </GuestRestrictionOverlay>
    )
    expect(screen.getByText('盆栽園マップは新規登録後にご利用いただけます。')).toBeInTheDocument()
  })
})
