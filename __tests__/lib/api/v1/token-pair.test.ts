// @vitest-environment node
/**
 * lib/api/v1/token-pair のユニットテスト
 *
 * issueTokenPair の正常系・MOBILE_JWT_SECRET 未設定・DB 保存の検証。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMockPrismaClient } from '../../../utils/test-utils'

const VALID_SECRET = 'a'.repeat(64)

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

describe('lib/api/v1/token-pair', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockPrisma.refreshToken = {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効な鍵でトークンペアを発行し DB に保存する', async () => {
    const { issueTokenPair } = await import('@/lib/api/v1/token-pair')
    const result = await issueTokenPair('user-123')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(typeof result.tokenPair.accessToken).toBe('string')
      expect(result.tokenPair.accessToken.split('.')).toHaveLength(3)
      expect(typeof result.tokenPair.refreshToken).toBe('string')
      expect(result.tokenPair.refreshToken.length).toBeGreaterThan(0)
      expect(result.tokenPair.expiresIn).toBe(900)
    }

    expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1)
    const createArgs = mockPrisma.refreshToken.create.mock.calls[0]
    expect(createArgs).toBeDefined()
    const data = (createArgs as unknown[])[0] as { data: { userId: string; tokenHash: string; expiresAt: Date } }
    expect(data.data.userId).toBe('user-123')
    expect(typeof data.data.tokenHash).toBe('string')
    expect(data.data.tokenHash.length).toBe(64)
    expect(data.data.expiresAt).toBeInstanceOf(Date)
  })

  it('リフレッシュトークンの生値は DB に保存されない（ハッシュのみ）', async () => {
    const { issueTokenPair } = await import('@/lib/api/v1/token-pair')
    const result = await issueTokenPair('user-456')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const createArgs = mockPrisma.refreshToken.create.mock.calls[0]
      const data = (createArgs as unknown[])[0] as { data: { tokenHash: string } }
      expect(data.data.tokenHash).not.toBe(result.tokenPair.refreshToken)
    }
  })

  it('MOBILE_JWT_SECRET 未設定で misconfigured を返す', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('MOBILE_JWT_SECRET', '')
    const { issueTokenPair } = await import('@/lib/api/v1/token-pair')
    const result = await issueTokenPair('user-789')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('misconfigured')
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled()
  })

  it('トランザクションクライアント（tx）を渡した場合、そのクライアント経由でリフレッシュトークンを作成する', async () => {
    const txCreate = vi.fn().mockResolvedValue({})
    const txClient = {
      refreshToken: {
        create: txCreate,
      },
    }

    const { issueTokenPair } = await import('@/lib/api/v1/token-pair')
    const result = await issueTokenPair('user-tx', txClient)

    expect(result.ok).toBe(true)
    // tx の create が呼ばれ、global prisma の create は呼ばれない
    expect(txCreate).toHaveBeenCalledTimes(1)
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled()

    const createArgs = txCreate.mock.calls[0]
    const data = (createArgs as unknown[])[0] as { data: { userId: string; tokenHash: string; expiresAt: Date } }
    expect(data.data.userId).toBe('user-tx')
    expect(data.data.tokenHash.length).toBe(64)
    expect(data.data.expiresAt).toBeInstanceOf(Date)
  })
})
