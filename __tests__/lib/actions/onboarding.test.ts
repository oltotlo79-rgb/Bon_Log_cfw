// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  RATE_LIMITS: {},
}))

describe('completeOnboarding', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  it('未認証ならエラーを返す', async () => {
    mockAuth.mockResolvedValue(null)
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    const result = await completeOnboarding()
    expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('onboardedAt を現在時刻で記録する', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: mockUser.id })
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    const result = await completeOnboarding()

    expect(result).toEqual({ success: true })
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: { onboardedAt: expect.any(Date) },
    })
  })

  it('DB 更新失敗時はエラーを返す', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('db down'))
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    const result = await completeOnboarding()
    expect(result.success).not.toBe(true)
  })

  it('Error 以外の値が throw されても ERR_OPERATION_FAILED を返す', async () => {
    mockPrisma.user.update.mockRejectedValue('connection reset')
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    const result = await completeOnboarding()
    expect(result).toEqual({ success: false, error: '操作に失敗しました' })
  })

  it('レート制限超過時はエラーを返し、DB更新を行わない', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    const result = await completeOnboarding()
    expect(result.success).toBe(false)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})
