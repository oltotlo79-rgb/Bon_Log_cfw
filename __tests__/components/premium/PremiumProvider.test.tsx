/**
 * PremiumProvider (Server Component) のテスト。
 *
 * 観点:
 * - 未ログインなら isPremium=false で Context に流す（DB 参照しない）
 * - ログイン + プレミアムなら isPremium=true
 * - ログイン + 無料会員なら isPremium=false
 * - children がそのままレンダリングされる
 *
 * @file PremiumProvider.test.tsx
 */

import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockAuth = vi.fn()
const mockIsPremiumUser = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

// usePremium は Context から値を取るだけの軽量フックなので実体を使う
import { usePremium } from '@/components/premium/PremiumContext'

function Probe() {
  const isPremium = usePremium()
  return <div data-testid="probe">{String(isPremium)}</div>
}

describe('PremiumProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未ログインの場合は isPremium=false を Context に流し、DB を参照しない', async () => {
    mockAuth.mockResolvedValue(null)

    const { PremiumProvider } = await import('@/components/premium/PremiumProvider')
    const element = await PremiumProvider({ children: <Probe /> })
    render(element)

    expect(screen.getByTestId('probe').textContent).toBe('false')
    // セキュリティ観点: 未ログインで DB に問い合わせないことを明示
    expect(mockIsPremiumUser).not.toHaveBeenCalled()
  })

  it('セッションに user.id がない場合も isPremium=false（防御）', async () => {
    mockAuth.mockResolvedValue({ user: {} })

    const { PremiumProvider } = await import('@/components/premium/PremiumProvider')
    const element = await PremiumProvider({ children: <Probe /> })
    render(element)

    expect(screen.getByTestId('probe').textContent).toBe('false')
    expect(mockIsPremiumUser).not.toHaveBeenCalled()
  })

  it('ログイン中のプレミアム会員なら isPremium=true を Context に流す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-premium' } })
    mockIsPremiumUser.mockResolvedValue(true)

    const { PremiumProvider } = await import('@/components/premium/PremiumProvider')
    const element = await PremiumProvider({ children: <Probe /> })
    render(element)

    expect(screen.getByTestId('probe').textContent).toBe('true')
    expect(mockIsPremiumUser).toHaveBeenCalledTimes(1)
    expect(mockIsPremiumUser).toHaveBeenCalledWith('user-premium')
  })

  it('ログイン中の無料会員なら isPremium=false を Context に流す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-free' } })
    mockIsPremiumUser.mockResolvedValue(false)

    const { PremiumProvider } = await import('@/components/premium/PremiumProvider')
    const element = await PremiumProvider({ children: <Probe /> })
    render(element)

    expect(screen.getByTestId('probe').textContent).toBe('false')
    expect(mockIsPremiumUser).toHaveBeenCalledWith('user-free')
  })

  it('children はそのままレンダリングされる', async () => {
    mockAuth.mockResolvedValue(null)

    const { PremiumProvider } = await import('@/components/premium/PremiumProvider')
    const element = await PremiumProvider({
      children: <div data-testid="child">hello</div>,
    })
    render(element)

    expect(screen.getByTestId('child')).toHaveTextContent('hello')
  })
})
