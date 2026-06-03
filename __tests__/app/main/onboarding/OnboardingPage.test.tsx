import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) } },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/actions/feed', () => ({ getRecommendedUsers: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))
vi.mock('@/components/user/RecommendedUserList', () => ({
  RecommendedUserList: () => <div data-testid="recommended-users" />,
}))
vi.mock('@/components/weather/WeatherLocationSetting', () => ({
  WeatherLocationSetting: () => <div data-testid="weather-setting" />,
}))
vi.mock('@/components/onboarding/OnboardingComplete', () => ({
  OnboardingComplete: () => <button>はじめる</button>,
}))

import { auth } from '@/lib/auth'
import { getRecommendedUsers } from '@/lib/actions/feed'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockGetRecommended = getRecommendedUsers as ReturnType<typeof vi.fn>

describe('OnboardingPage', async () => {
  let Page: typeof import('@/app/(main)/onboarding/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetRecommended.mockResolvedValue({ users: [{ id: 'u2', nickname: 'A', avatarUrl: null, followersCount: 1 }] })
    Page = (await import('@/app/(main)/onboarding/page')).default
  })

  it('未認証なら /login にリダイレクトする', async () => {
    mockAuth.mockResolvedValue(null as never)
    await expect(Page()).rejects.toThrow('REDIRECT:/login')
  })

  it('ゲストは /feed にリダイレクトする', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'g1', email: 'guest@bon-log.local' } } as never)
    // GUEST_EMAIL を実値に合わせるためモジュール実値を使う
    const { GUEST_EMAIL } = await import('@/lib/constants/guest')
    mockAuth.mockResolvedValue({ user: { id: 'g1', email: GUEST_EMAIL } } as never)
    await expect(Page()).rejects.toThrow('REDIRECT:/feed')
  })

  it('オンボーディング済みは /feed にリダイレクトする', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'a@example.com' } } as never)
    mockUserFindUnique.mockResolvedValue({ onboardedAt: new Date() })
    await expect(Page()).rejects.toThrow('REDIRECT:/feed')
  })

  it('未完了ユーザーにはオンボーディング各セクションを表示する', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'a@example.com' } } as never)
    mockUserFindUnique.mockResolvedValue({ onboardedAt: null })

    const result = await Page()
    render(result)

    expect(screen.getByTestId('recommended-users')).toBeInTheDocument()
    expect(screen.getByTestId('weather-setting')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'はじめる' })).toBeInTheDocument()
  })
})
