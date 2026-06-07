// @vitest-environment node
/**
 * auth.ts 完全カバレッジテスト
 *
 * 既存テストでカバーされていないブランチ・関数を網羅する:
 * - ゲストログインパス (authorize内のGUEST_EMAIL分岐)
 * - emailVerified チェック
 * - Google OAuth profile コールバック
 * - JWT callback の admin/email 設定
 * - Session callback の email/isAdmin 設定
 * - createUser イベントハンドラー (実コード経由)
 * - server-only 条件付きインポート
 */
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'

// グローバルモックを解除して実モジュールをテスト
vi.unmock('@/lib/auth')

// ============================================================
// モック設定
// ============================================================

const mockUserFindUnique = vi.fn()
const mockUserCreate = vi.fn()
const mockUserUpdate = vi.fn()
const mockAdminFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
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

// Capture authorize, callbacks, events, and Google profile from actual module
let capturedAuthorize: (credentials: Record<string, unknown>) => Promise<unknown>
let capturedCallbacks: {
  jwt: (params: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Promise<Record<string, unknown>>
  session: (params: { session: Record<string, unknown>; token: Record<string, unknown> }) => Promise<Record<string, unknown>>
}
let capturedEvents: {
  createUser: (params: { user: Record<string, unknown> }) => Promise<void>
}
let capturedGoogleProfile: (profile: Record<string, unknown>) => Record<string, unknown>

vi.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: vi.fn((config: Record<string, unknown>) => {
    capturedAuthorize = config.authorize as typeof capturedAuthorize
    return { id: 'credentials', type: 'credentials', ...config }
  }),
}))

vi.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: vi.fn((config: Record<string, unknown>) => {
    capturedGoogleProfile = config.profile as typeof capturedGoogleProfile
    return { id: 'google', type: 'oauth', ...config }
  }),
}))

vi.mock('next-auth', () => ({
  __esModule: true,
  default: vi.fn((config: Record<string, unknown>) => {
    capturedCallbacks = config.callbacks as typeof capturedCallbacks
    capturedEvents = config.events as typeof capturedEvents
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

const mockConsumeTwoFactorLoginTicket = vi.fn()
vi.mock('@/lib/two-factor-login-ticket', () => ({
  consumeTwoFactorLoginTicket: (...args: unknown[]) => mockConsumeTwoFactorLoginTicket(...args),
}))

// authorize() がサーバー側でロックアウト記録/リセットを行うため login-throttle を mock する。
// 既定は「許可」。実際のスロットルロジックは login-throttle.test.ts 側で検証する。
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

describe('auth.ts 完全カバレッジ', () => {
  beforeAll(async () => {
    // auth.ts をインポートして全キャプチャを初期化
    await import('@/lib/auth')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // ゲストログイン (authorize内 GUEST_EMAIL 分岐)
  // ============================================================

  describe('authorize - ゲストログイン', () => {
    const GUEST_EMAIL = 'guest@example.com'

    it('GUEST_PASSWORDが未設定の場合nullを返す', async () => {
      // GUEST_PASSWORD が空文字列のとき (デフォルト)
      const originalPassword = process.env.GUEST_PASSWORD
      delete process.env.GUEST_PASSWORD

      const result = await capturedAuthorize({
        email: GUEST_EMAIL,
        password: 'somepassword123',
      })
      expect(result).toBeNull()

      // 復元
      if (originalPassword !== undefined) {
        process.env.GUEST_PASSWORD = originalPassword
      }
    })

    it('ゲストユーザーが存在しない場合nullを返す', async () => {
      const originalPassword = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'

      mockUserFindUnique.mockResolvedValueOnce(null)

      const result = await capturedAuthorize({
        email: GUEST_EMAIL,
        password: 'guestpass123',
      })
      expect(result).toBeNull()

      process.env.GUEST_PASSWORD = originalPassword
    })

    it('ゲストユーザーのパスワードがnullの場合nullを返す', async () => {
      const originalPassword = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'

      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1',
        email: GUEST_EMAIL,
        password: null,
        nickname: 'Guest',
        avatarUrl: null,
        isSuspended: false,
        emailVerified: new Date(),
      })

      const result = await capturedAuthorize({
        email: GUEST_EMAIL,
        password: 'guestpass123',
      })
      expect(result).toBeNull()

      process.env.GUEST_PASSWORD = originalPassword
    })

    it('ゲストユーザーのemailVerifiedがnullの場合nullを返す', async () => {
      const originalPassword = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'

      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1',
        email: GUEST_EMAIL,
        password: '$2a$12$hash',
        nickname: 'Guest',
        avatarUrl: null,
        isSuspended: false,
        emailVerified: null,
      })

      const result = await capturedAuthorize({
        email: GUEST_EMAIL,
        password: 'guestpass123',
      })
      expect(result).toBeNull()

      process.env.GUEST_PASSWORD = originalPassword
    })

    it('ゲストユーザーが停止されている場合nullを返す', async () => {
      const originalPassword = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'

      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1',
        email: GUEST_EMAIL,
        password: '$2a$12$hash',
        nickname: 'Guest',
        avatarUrl: null,
        isSuspended: true,
        emailVerified: new Date(),
      })

      const result = await capturedAuthorize({
        email: GUEST_EMAIL,
        password: 'guestpass123',
      })
      expect(result).toBeNull()

      process.env.GUEST_PASSWORD = originalPassword
    })

    it('ゲストのパスワードが不一致の場合nullを返す', async () => {
      const originalPassword = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'

      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1',
        email: GUEST_EMAIL,
        password: '$2a$12$hash',
        nickname: 'Guest',
        avatarUrl: null,
        isSuspended: false,
        emailVerified: new Date(),
      })
      mockBcryptCompare.mockResolvedValueOnce(false)

      const result = await capturedAuthorize({
        email: GUEST_EMAIL,
        password: 'wrongpassword1',
      })
      expect(result).toBeNull()

      process.env.GUEST_PASSWORD = originalPassword
    })

    it('ゲストログインが成功するとユーザーオブジェクトを返す', async () => {
      const originalPassword = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'

      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1',
        email: GUEST_EMAIL,
        password: '$2a$12$hash',
        nickname: 'Guest User',
        avatarUrl: '/guest-avatar.jpg',
        isSuspended: false,
        emailVerified: new Date(),
      })
      mockBcryptCompare.mockResolvedValueOnce(true)

      const result = await capturedAuthorize({
        email: GUEST_EMAIL,
        password: 'guestpass123',
      })
      expect(result).toEqual({
        id: 'guest-1',
        email: GUEST_EMAIL,
        name: 'Guest User',
        image: '/guest-avatar.jpg',
      })

      process.env.GUEST_PASSWORD = originalPassword
    })
  })

  // ============================================================
  // authorize - emailVerified チェック (通常ユーザー)
  // ============================================================

  describe('authorize - emailVerified チェック', () => {
    it('emailVerifiedがnullの場合nullを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'unverified@example.com',
        password: '$2a$12$hash',
        nickname: 'Unverified',
        avatarUrl: null,
        isSuspended: false,
        emailVerified: null,
      })

      const result = await capturedAuthorize({
        email: 'unverified@example.com',
        password: 'password123',
      })
      expect(result).toBeNull()
      // bcrypt.compare should NOT be called because emailVerified check comes first
      expect(mockBcryptCompare).not.toHaveBeenCalled()
    })

    it('emailVerifiedが設定済みでisSuspendedの場合nullを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u1',
        email: 'suspended@example.com',
        password: '$2a$12$hash',
        nickname: 'Suspended',
        avatarUrl: null,
        isSuspended: true,
        emailVerified: new Date(),
      })

      const result = await capturedAuthorize({
        email: 'suspended@example.com',
        password: 'password123',
      })
      expect(result).toBeNull()
      // bcrypt.compare should NOT be called because isSuspended check comes first
      expect(mockBcryptCompare).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // authorize - 2FA サーバーサイド強制 (チケット消費)
  // ============================================================

  describe('authorize - 2FA サーバーサイド強制', () => {
    const twoFactorUser = {
      id: 'u-2fa',
      email: '2fa@example.com',
      password: '$2a$12$hash',
      nickname: 'TwoFactor',
      avatarUrl: null,
      isSuspended: false,
      emailVerified: new Date(),
      twoFactorEnabled: true,
    }

    it('2FA有効ユーザーは有効なチケットがあればログインできる', async () => {
      mockUserFindUnique.mockResolvedValueOnce(twoFactorUser)
      mockBcryptCompare.mockResolvedValueOnce(true)
      mockConsumeTwoFactorLoginTicket.mockResolvedValueOnce(true)

      const result = await capturedAuthorize({
        email: '2fa@example.com',
        password: 'password123',
        twoFactorTicket: 'valid-ticket',
      })

      expect(result).toMatchObject({ id: 'u-2fa', email: '2fa@example.com' })
      expect(mockConsumeTwoFactorLoginTicket).toHaveBeenCalledWith('2fa@example.com', 'valid-ticket')
    })

    it('2FA有効ユーザーはチケットが無効/欠落なら null（バイパス不可）', async () => {
      mockUserFindUnique.mockResolvedValueOnce(twoFactorUser)
      mockBcryptCompare.mockResolvedValueOnce(true)
      mockConsumeTwoFactorLoginTicket.mockResolvedValueOnce(false)

      const result = await capturedAuthorize({
        email: '2fa@example.com',
        password: 'password123',
      })

      expect(result).toBeNull()
      expect(mockConsumeTwoFactorLoginTicket).toHaveBeenCalledWith('2fa@example.com', '')
    })

    it('2FA無効ユーザーはチケット検証を行わずログインできる', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ ...twoFactorUser, twoFactorEnabled: false })
      mockBcryptCompare.mockResolvedValueOnce(true)

      const result = await capturedAuthorize({
        email: '2fa@example.com',
        password: 'password123',
      })

      expect(result).toMatchObject({ id: 'u-2fa' })
      expect(mockConsumeTwoFactorLoginTicket).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // authorize - ロックアウト記録（P0 回帰: 通常ログイン失敗もサーバー側で必ず記録される）
  // ============================================================
  describe('authorize - ロックアウト記録/リセット', () => {
    const verifiedUser = {
      id: 'u-lock',
      email: 'lock@example.com',
      password: '$2a$12$hash',
      nickname: 'Lock',
      avatarUrl: null,
      isSuspended: false,
      emailVerified: new Date(),
      twoFactorEnabled: false,
    }

    it('ロック中（throttle 不許可）は DB を引かず null を返す', async () => {
      mockCheckLoginThrottle.mockResolvedValueOnce({ allowed: false, remainingAttempts: 0 })

      const result = await capturedAuthorize({ email: 'lock@example.com', password: 'password123' })

      expect(result).toBeNull()
      expect(mockUserFindUnique).not.toHaveBeenCalled()
    })

    it('パスワード不一致でログイン失敗を記録し null を返す（2FA 有無に依らず）', async () => {
      mockUserFindUnique.mockResolvedValueOnce(verifiedUser)
      mockBcryptCompare.mockResolvedValueOnce(false)

      const result = await capturedAuthorize({ email: 'lock@example.com', password: 'wrongpassword' })

      expect(result).toBeNull()
      expect(mockRecordLoginFailure).toHaveBeenCalledWith('lock@example.com')
      expect(mockResetLoginThrottle).not.toHaveBeenCalled()
    })

    it('存在しないユーザーでもログイン失敗を記録する', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null)

      const result = await capturedAuthorize({ email: 'nobody@example.com', password: 'password123' })

      expect(result).toBeNull()
      expect(mockRecordLoginFailure).toHaveBeenCalledWith('nobody@example.com')
    })

    it('ログイン成功時は失敗カウンタをリセットする', async () => {
      mockUserFindUnique.mockResolvedValueOnce(verifiedUser)
      mockBcryptCompare.mockResolvedValueOnce(true)

      const result = await capturedAuthorize({ email: 'lock@example.com', password: 'password123' })

      expect(result).toMatchObject({ id: 'u-lock' })
      expect(mockResetLoginThrottle).toHaveBeenCalledWith('lock@example.com')
      expect(mockRecordLoginFailure).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // Google OAuth profile コールバック
  // ============================================================

  describe('Google OAuth profile コールバック', () => {
    it('Googleプロフィールからユーザーオブジェクトを正しくマッピングする', () => {
      expect(capturedGoogleProfile).toBeDefined()

      const googleProfile = {
        sub: 'google-id-123',
        name: 'Google Taro',
        email: 'taro@gmail.com',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      }

      const result = capturedGoogleProfile(googleProfile)
      expect(result).toEqual({
        id: 'google-id-123',
        name: 'Google Taro',
        email: 'taro@gmail.com',
        image: 'https://lh3.googleusercontent.com/photo.jpg',
      })
    })

    it('pictureがundefinedの場合もマッピングする', () => {
      const googleProfile = {
        sub: 'google-id-456',
        name: 'No Photo',
        email: 'nophoto@gmail.com',
        picture: undefined,
      }

      const result = capturedGoogleProfile(googleProfile)
      expect(result).toEqual({
        id: 'google-id-456',
        name: 'No Photo',
        email: 'nophoto@gmail.com',
        image: undefined,
      })
    })
  })

  // ============================================================
  // createUser イベント (実コード経由)
  // ============================================================

  describe('events.createUser (実コード経由)', () => {
    it('idとnameがある場合にnicknameとemailVerifiedを更新する', async () => {
      expect(capturedEvents).toBeDefined()
      mockUserUpdate.mockResolvedValueOnce({})

      await capturedEvents.createUser({
        user: { id: 'oauth-user-1', name: 'OAuth User' },
      })

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'oauth-user-1' },
        data: {
          nickname: 'OAuth User',
          emailVerified: expect.any(Date),
        },
      })
    })

    it('idがない場合はupdateを呼ばない', async () => {
      await capturedEvents.createUser({
        user: { name: 'No ID' },
      })

      expect(mockUserUpdate).not.toHaveBeenCalled()
    })

    it('nameがない場合はupdateを呼ばない', async () => {
      await capturedEvents.createUser({
        user: { id: 'oauth-user-2' },
      })

      expect(mockUserUpdate).not.toHaveBeenCalled()
    })

    it('idとnameの両方が空文字の場合はupdateを呼ばない', async () => {
      await capturedEvents.createUser({
        user: { id: '', name: '' },
      })

      expect(mockUserUpdate).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // JWT コールバック - admin/email 設定
  // ============================================================

  describe('jwt コールバック - admin/email 設定', () => {
    it('管理者ユーザーの場合 isAdmin=true をトークンに設定する', async () => {
      mockAdminFindUnique.mockResolvedValueOnce({ userId: 'admin-1' })

      const token = {} as Record<string, unknown>
      const user = { id: 'admin-1', email: 'admin@example.com' }
      const result = await capturedCallbacks.jwt({ token, user })

      expect(result.id).toBe('admin-1')
      expect(result.email).toBe('admin@example.com')
      expect(result.isAdmin).toBe(true)
    })

    it('一般ユーザーの場合 isAdmin=false をトークンに設定する', async () => {
      mockAdminFindUnique.mockResolvedValueOnce(null)

      const token = {} as Record<string, unknown>
      const user = { id: 'user-1', email: 'user@example.com' }
      const result = await capturedCallbacks.jwt({ token, user })

      expect(result.id).toBe('user-1')
      expect(result.email).toBe('user@example.com')
      expect(result.isAdmin).toBe(false)
    })

    it('userがない場合（トークン更新時）はトークンをそのまま返す', async () => {
      const token = { id: 'existing-id', email: 'existing@example.com', isAdmin: true } as Record<string, unknown>
      const result = await capturedCallbacks.jwt({ token })

      expect(result.id).toBe('existing-id')
      expect(result.email).toBe('existing@example.com')
      expect(result.isAdmin).toBe(true)
      expect(mockAdminFindUnique).not.toHaveBeenCalled()
    })

    it('user.emailがundefinedの場合もトークンに設定する', async () => {
      mockAdminFindUnique.mockResolvedValueOnce(null)

      const token = {} as Record<string, unknown>
      const user = { id: 'user-no-email' }
      const result = await capturedCallbacks.jwt({ token, user })

      expect(result.id).toBe('user-no-email')
      expect(result.email).toBeUndefined()
      expect(result.isAdmin).toBe(false)
    })
  })

  // ============================================================
  // Session コールバック - email/isAdmin 設定
  // ============================================================

  describe('session コールバック - email/isAdmin 設定', () => {
    it('トークンからemailとisAdminをセッションに追加する', async () => {
      const session = {
        user: { name: 'Test' } as Record<string, unknown>,
      }
      const token = { id: 'user-1', email: 'user@example.com', isAdmin: true }

      const result = await capturedCallbacks.session({ session, token })

      expect((result as { user: Record<string, unknown> }).user.id).toBe('user-1')
      expect((result as { user: Record<string, unknown> }).user.email).toBe('user@example.com')
      expect((result as { user: Record<string, unknown> }).user.isAdmin).toBe(true)
    })

    it('token.emailがfalsyの場合はemailを設定しない', async () => {
      const session = {
        user: { name: 'Test', email: 'original@example.com' } as Record<string, unknown>,
      }
      const token = { id: 'user-1', isAdmin: false }

      const result = await capturedCallbacks.session({ session, token })
      const user = (result as { user: Record<string, unknown> }).user

      expect(user.id).toBe('user-1')
      // email should remain the original since token.email is falsy
      expect(user.email).toBe('original@example.com')
      expect(user.isAdmin).toBe(false)
    })

    it('token.isAdminがundefinedの場合はfalseとして扱う', async () => {
      const session = {
        user: { name: 'Test' } as Record<string, unknown>,
      }
      const token = { id: 'user-1', email: 'user@example.com' }

      const result = await capturedCallbacks.session({ session, token })
      const user = (result as { user: Record<string, unknown> }).user

      expect(user.isAdmin).toBe(false)
    })

    it('session.userがfalsyの場合はセッションを変更しない', async () => {
      const session = {
        user: undefined as unknown as Record<string, unknown>,
      }
      const token = { id: 'user-1', email: 'user@example.com', isAdmin: true }

      const result = await capturedCallbacks.session({ session, token })

      expect((result as { user: unknown }).user).toBeUndefined()
    })

    it('token.idがfalsyの場合はセッションを変更しない', async () => {
      const session = {
        user: { name: 'Test' } as Record<string, unknown>,
      }
      const token = { email: 'user@example.com', isAdmin: true }

      const result = await capturedCallbacks.session({ session, token })
      const user = (result as { user: Record<string, unknown> }).user

      expect(user.id).toBeUndefined()
    })
  })

  // ============================================================
  // registerUser - 追加ブランチ
  // ============================================================

  describe('registerUser - 追加テスト', () => {
    let registerUser: (data: { email: string; password: string; nickname: string }) => Promise<unknown>

    beforeAll(async () => {
      const authModule = await import('@/lib/auth')
      registerUser = authModule.registerUser
    })

    it('bcrypt.hashにBCRYPT_SALT_ROUNDS(12)を渡す', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null)
      mockBcryptHash.mockResolvedValueOnce('$2a$12$newHash')
      mockUserCreate.mockResolvedValueOnce({
        id: 'new-id',
        email: 'test@example.com',
        nickname: 'Test',
      })

      await registerUser({
        email: 'test@example.com',
        password: 'mypassword123',
        nickname: 'Test',
      })

      // Verify bcrypt.hash is called with correct salt rounds (12)
      expect(mockBcryptHash).toHaveBeenCalledWith('mypassword123', 12)
    })

    it('prisma.user.createにハッシュ化済みパスワードを渡す', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null)
      mockBcryptHash.mockResolvedValueOnce('$2a$12$hashedPW')
      mockUserCreate.mockResolvedValueOnce({
        id: 'new-id',
        email: 'create@example.com',
        nickname: 'Creator',
      })

      await registerUser({
        email: 'create@example.com',
        password: 'plaintext123',
        nickname: 'Creator',
      })

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: {
          email: 'create@example.com',
          password: '$2a$12$hashedPW',
          nickname: 'Creator',
        },
      })
    })
  })
})
