// @vitest-environment node
import { vi } from 'vitest'

export {}

// Mock prisma
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}))

// Mock bcryptjs
const mockHash = vi.fn()
const mockCompare = vi.fn()
vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: (...args: unknown[]) => mockHash(...args),
    compare: (...args: unknown[]) => mockCompare(...args),
  },
}))

vi.mock('next-auth', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue({
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(),
  }),
}))

vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(),
}))

vi.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/auth.config', () => ({
  authConfig: { pages: { signIn: '/login' }, callbacks: {}, providers: [] },
}))

/**
 * registerUser のロジックを直接テスト
 * (lib/auth.ts の registerUser 関数と同じフロー)
 */
describe('registerUser logic', async () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockCreate.mockReset()
    mockHash.mockReset()
  })

  it('新規ユーザーを正常に登録する', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockHash.mockResolvedValue('$2a$12$hashed')
    mockCreate.mockResolvedValue({
      id: 'new-id',
      email: 'new@example.com',
      nickname: 'NewUser',
    })

    const bcrypt = { hash: mockHash, compare: mockCompare }
    const { prisma } = await import('@/lib/db')

    const data = { email: 'new@example.com', password: 'password123', nickname: 'NewUser' }
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingUser) throw new Error('このメールアドレスは既に使用されています')

    const hashedPassword = await bcrypt.hash(data.password, 12)
    const result = await prisma.user.create({
      data: { email: data.email, password: hashedPassword, nickname: data.nickname },
    })

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } })
    expect(mockHash).toHaveBeenCalledWith('password123', 12)
    expect(mockCreate).toHaveBeenCalledWith({
      data: { email: 'new@example.com', password: '$2a$12$hashed', nickname: 'NewUser' },
    })
    expect(result.id).toBe('new-id')
  })

  it('既存メールアドレスでエラーをスローする', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existing', email: 'exists@example.com' })

    const { prisma } = await import('@/lib/db')
    const data = { email: 'exists@example.com', password: 'password123', nickname: 'User' }
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } })

    expect(existingUser).toBeTruthy()
    expect(() => {
      if (existingUser) throw new Error('このメールアドレスは既に使用されています')
    }).toThrow('このメールアドレスは既に使用されています')
  })
})

/**
 * authorize コールバックのロジックを直接テスト
 * (lib/auth.ts の authorize 関数と同じフロー)
 */
describe('authorize callback logic', async () => {
  const { z } = await import('zod')
  const loginSchema = z.object({
    email: z.string().email('有効なメールアドレスを入力してください'),
    password: z.string().min(8, 'パスワードは8文字以上である必要があります'),
  })

  // Replicate the authorize function logic from lib/auth.ts
  async function authorize(credentials: any) {
    const result = loginSchema.safeParse(credentials)
    if (!result.success) return null

    const { email, password } = result.data

    const user = await mockFindUnique({
      where: { email },
      select: {
        id: true, email: true, password: true,
        nickname: true, avatarUrl: true, isSuspended: true,
      },
    })

    if (!user || !user.password) return null
    if (user.isSuspended) return null

    const passwordMatch = await mockCompare(password, user.password)
    if (!passwordMatch) return null

    return {
      id: user.id,
      email: user.email,
      name: user.nickname,
      image: user.avatarUrl,
    }
  }

  beforeEach(() => {
    mockFindUnique.mockReset()
    mockCompare.mockReset()
  })

  it('無効な入力でnullを返す', async () => {
    const result = await authorize({ email: 'bad', password: '123' })
    expect(result).toBeNull()
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('存在しないユーザーでnullを返す', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await authorize({ email: 'noone@example.com', password: 'password123' })
    expect(result).toBeNull()
  })

  it('パスワードがないユーザーでnullを返す', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1', email: 'oauth@example.com', password: null,
      nickname: 'OAuth', avatarUrl: null, isSuspended: false,
    })
    const result = await authorize({ email: 'oauth@example.com', password: 'password123' })
    expect(result).toBeNull()
  })

  it('停止されたアカウントでnullを返す', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1', email: 'suspended@example.com', password: '$2a$12$hash',
      nickname: 'Suspended', avatarUrl: null, isSuspended: true,
    })
    const result = await authorize({ email: 'suspended@example.com', password: 'password123' })
    expect(result).toBeNull()
  })

  it('パスワード不一致でnullを返す', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1', email: 'user@example.com', password: '$2a$12$hash',
      nickname: 'User', avatarUrl: null, isSuspended: false,
    })
    mockCompare.mockResolvedValue(false)
    const result = await authorize({ email: 'user@example.com', password: 'wrongpassword' })
    expect(result).toBeNull()
  })

  it('正しい認証情報でユーザーオブジェクトを返す', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'u1', email: 'user@example.com', password: '$2a$12$hash',
      nickname: 'User', avatarUrl: '/avatar.jpg', isSuspended: false,
    })
    mockCompare.mockResolvedValue(true)
    const result = await authorize({ email: 'user@example.com', password: 'password123' })
    expect(result).toEqual({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      image: '/avatar.jpg',
    })
  })

  it('メールアドレスが空の場合nullを返す', async () => {
    const result = await authorize({ email: '', password: 'password123' })
    expect(result).toBeNull()
  })

  it('パスワードが短い場合nullを返す', async () => {
    const result = await authorize({ email: 'test@example.com', password: 'short' })
    expect(result).toBeNull()
  })
})
