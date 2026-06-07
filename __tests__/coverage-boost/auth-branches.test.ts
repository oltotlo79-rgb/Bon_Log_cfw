// @vitest-environment node
/**
 * auth.ts ブランチカバレッジ向上テスト
 *
 * NextAuth設定内のauthorize関数・コールバック・registerUserを
 * 実際のソースコードから取得してテストする
 */
import { vi } from 'vitest'

// グローバルモックを解除して実モジュールをテスト
vi.unmock('@/lib/auth')

// ============================================================
// モック設定
// ============================================================

const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockAdminFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminFindUnique(...args),
    },
  },
}))

const mockBcryptHash = vi.fn()
const mockBcryptCompare = vi.fn()
vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    hash: (...args: unknown[]) => mockBcryptHash(...args),
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
  },
}))

// Capture the authorize function and callbacks from the actual module
 
let capturedAuthorize: any
 
let capturedCallbacks: any
 
let capturedRegisterUser: any

vi.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: vi.fn((config: Record<string, unknown>) => {
    capturedAuthorize = config.authorize
    return { id: 'credentials', type: 'credentials', ...config }
  }),
}))

vi.mock('next-auth', () => ({
  __esModule: true,
  default: vi.fn((config: Record<string, unknown>) => {
    capturedCallbacks = config.callbacks
    return {
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    }
  }),
}))

vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(),
}))

vi.mock('@/lib/auth.config', () => ({
  authConfig: { pages: { signIn: '/login' }, callbacks: {} },
}))

// authorize() のサーバー側ロックアウト記録/リセットを mock する（既定は許可）。
const mockCheckLoginThrottle = vi.fn().mockResolvedValue({ allowed: true, remainingAttempts: 5 })
const mockRecordLoginFailure = vi.fn().mockResolvedValue({ allowed: true, remainingAttempts: 4 })
const mockResetLoginThrottle = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/services/login-throttle', () => ({
  checkLoginThrottleForRequest: (...args: unknown[]) => mockCheckLoginThrottle(...args),
  recordLoginFailureForRequest: (...args: unknown[]) => mockRecordLoginFailure(...args),
  resetLoginThrottleForRequest: (...args: unknown[]) => mockResetLoginThrottle(...args),
}))

// ============================================================
// テスト
// ============================================================

describe('auth.ts ブランチカバレッジ', () => {
  beforeAll(async () => {
    // auth.ts をインポートして capturedAuthorize/capturedCallbacks を取得
    // registerUser は named export なので直接取得
    const authModule = await import('@/lib/auth')
    capturedRegisterUser = authModule.registerUser
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // authorize 関数 (実際のソースコードのブランチ)
  // ============================================================

  describe('authorize関数', () => {
    it('バリデーション失敗時にnullを返す（無効なメール）', async () => {
      expect(capturedAuthorize).toBeDefined()
      const result = await capturedAuthorize({ email: 'bad', password: '12345678' })
      expect(result).toBeNull()
    })

    it('バリデーション失敗時にnullを返す（短いパスワード）', async () => {
      const result = await capturedAuthorize({ email: 'test@example.com', password: 'short' })
      expect(result).toBeNull()
    })

    it('ユーザーが存在しない場合にnullを返す', async () => {
      mockFindUnique.mockResolvedValue(null)
      const result = await capturedAuthorize({ email: 'noone@example.com', password: 'password123' })
      expect(result).toBeNull()
    })

    it('パスワードがnullのユーザー（OAuth）でnullを返す', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'u1', email: 'oauth@example.com', password: null,
        nickname: 'OAuth', avatarUrl: null, isSuspended: false,
      })
      const result = await capturedAuthorize({ email: 'oauth@example.com', password: 'password123' })
      expect(result).toBeNull()
    })

    it('停止されたアカウントでnullを返す', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'u1', email: 'suspended@example.com', password: '$2a$12$hash',
        nickname: 'Suspended', avatarUrl: null, isSuspended: true,
      })
      const result = await capturedAuthorize({ email: 'suspended@example.com', password: 'password123' })
      expect(result).toBeNull()
    })

    it('パスワード不一致でnullを返す', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'u1', email: 'user@example.com', password: '$2a$12$hash',
        nickname: 'User', avatarUrl: null, isSuspended: false,
      })
      mockBcryptCompare.mockResolvedValue(false)
      const result = await capturedAuthorize({ email: 'user@example.com', password: 'wrongpassword' })
      expect(result).toBeNull()
    })

    it('正しい認証情報でユーザーオブジェクトを返す', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'u1', email: 'user@example.com', password: '$2a$12$hash',
        nickname: 'User', avatarUrl: '/avatar.jpg', isSuspended: false,
        emailVerified: new Date(),
      })
      mockBcryptCompare.mockResolvedValue(true)
      const result = await capturedAuthorize({ email: 'user@example.com', password: 'password123' })
      expect(result).toEqual({
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        image: '/avatar.jpg',
      })
    })
  })

  // ============================================================
  // JWT コールバック
  // ============================================================

  describe('jwt コールバック', () => {
    it('初回サインイン時にuser.idをトークンに追加する', async () => {
      expect(capturedCallbacks).toBeDefined()
      mockAdminFindUnique.mockResolvedValueOnce(null)
      const token = { email: 'test@example.com' } as Record<string, unknown>
      const user = { id: 'user-123' }
      const result = await capturedCallbacks.jwt({ token, user })
      expect(result.id).toBe('user-123')
    })

    it('userがない場合はトークンを変更しない', async () => {
      const token = { email: 'test@example.com' } as Record<string, unknown>
      const result = await capturedCallbacks.jwt({ token, user: undefined })
      expect(result.id).toBeUndefined()
    })
  })

  // ============================================================
  // Session コールバック
  // ============================================================

  describe('session コールバック', () => {
    it('トークンからセッションにユーザーIDを追加する', async () => {
      const session = { user: { email: 'test@example.com' } as Record<string, unknown> }
      const token = { id: 'user-123' }
      const result = await capturedCallbacks.session({ session, token })
      expect(result.user.id).toBe('user-123')
    })

    it('token.idがない場合はセッションを変更しない', async () => {
      const session = { user: { email: 'test@example.com' } as Record<string, unknown> }
      const token = {} as { id?: string }
      const result = await capturedCallbacks.session({ session, token })
      expect(result.user.id).toBeUndefined()
    })
  })

  // ============================================================
  // registerUser (実際のソースコードのブランチ)
  // ============================================================

  describe('registerUser', () => {
    it('新規ユーザーを正常に登録する', async () => {
      expect(capturedRegisterUser).toBeDefined()

      mockFindUnique.mockResolvedValue(null)
      mockBcryptHash.mockResolvedValue('$2a$12$hashed')
      mockCreate.mockResolvedValue({
        id: 'new-id', email: 'new@example.com', nickname: 'NewUser',
      })

      const result = await capturedRegisterUser({
        email: 'new@example.com',
        password: 'password123',
        nickname: 'NewUser',
      })

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } })
      expect(mockBcryptHash).toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalled()
      expect(result.id).toBe('new-id')
    })

    it('既存メールアドレスでエラーをスローする', async () => {
      mockFindUnique.mockResolvedValue({ id: 'existing', email: 'exists@example.com' })

      await expect(
        capturedRegisterUser({ email: 'exists@example.com', password: 'password123', nickname: 'User' })
      ).rejects.toThrow('このメールアドレスは既に使用されています')
    })
  })
})
