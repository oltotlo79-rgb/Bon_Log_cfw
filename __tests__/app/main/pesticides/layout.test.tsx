import React from 'react'
import { vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import PesticideLayout from '@/app/(main)/pesticides/layout'

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/components/common/GuestRestrictionOverlay', () => ({
  GuestRestrictionOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('PesticideLayout', () => {
  it('子要素をそのまま表示する', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
    const children = <div data-testid="pesticide-child">農薬トップコンテンツ</div>
    let jsx: React.ReactNode
    await act(async () => {
      jsx = await PesticideLayout({ children })
    })
    render(jsx!)
    expect(screen.getByTestId('pesticide-child')).toBeInTheDocument()
    expect(screen.getByText('農薬トップコンテンツ')).toBeInTheDocument()
  })
})
