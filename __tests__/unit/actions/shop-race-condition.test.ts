// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockShop } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// レート制限モック
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { create_shop: { limit: 10, window: 60 } },
}))

// headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

describe('createShop - 重複検出・レース条件テスト', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // requireActiveUser needs user.findUnique for suspension check
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  it('同一住所が既に登録されている場合は success: false と existingId を返す', async () => {
    mockPrisma.bonsaiShop.findFirst.mockResolvedValue({
      id: 'existing-shop-id',
      address: '東京都渋谷区代々木1-1-1',
    })

    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト盆栽園')
    formData.append('address', '東京都渋谷区代々木1-1-1')

    const result = await createShop(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
    expect('existingId' in result && result.existingId).toBe('existing-shop-id')
  })

  it('重複なしの場合は正常に作成できる', async () => {
    mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
    mockPrisma.bonsaiShop.create.mockResolvedValue({
      ...mockShop,
      id: 'new-shop-id',
    })

    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', '新しい盆栽園')
    formData.append('address', '大阪府大阪市1-1-1')

    const result = await createShop(formData)

    expect(result).toMatchObject({ success: true, data: { shopId: 'new-shop-id' } })
  })

  it('DB作成時にユニーク制約違反（レース条件）が発生した場合はエラーを返す', async () => {
    mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
    // findFirst が null を返した後、createで一意制約違反が発生するシナリオ
    const uniqueConstraintError = new Error('Unique constraint failed on the fields: (`address`)')
    mockPrisma.bonsaiShop.create.mockRejectedValue(uniqueConstraintError)

    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト盆栽園')
    formData.append('address', '東京都新宿区1-1-1')

    const result = await createShop(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it('複数の不正な緯度が入力された場合はエラーを返す', async () => {
    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト盆栽園')
    formData.append('address', '東京都渋谷区代々木1-1-1')
    formData.append('latitude', 'not-a-number')

    const result = await createShop(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })
})
