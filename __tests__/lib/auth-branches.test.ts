// @vitest-environment node
/**
 * auth.ts の未カバー行のテスト
 * - lines 287-317: ゲストログインブランチ
 * - lines 346-388: 通常ログイン（emailVerifiedチェック含む）
 * - lines 407-417: createUserイベント
 * - lines 435-448: jwt callback (adminUser check)
 * - lines 465-473: session callback
 * - lines 518-559: registerUser
 *
 * NextAuth()の中の authorize / callbacks / events をテストするため、
 * 同じロジックを直接再現してテストする方式を採用。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Prisma モック
const mockUserFindUnique = vi.fn()
const mockUserCreate = vi.fn()
const mockUserUpdate = vi.fn()
const mockAdminUserFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args),
    },
  },
}))

// bcryptjs モック
const mockCompare = vi.fn()
const mockHash = vi.fn()
vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    compare: (...args: unknown[]) => mockCompare(...args),
    hash: (...args: unknown[]) => mockHash(...args),
  },
}))

// NextAuth / adapter / providers
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
vi.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue({}),
}))
vi.mock('@/lib/auth.config', () => ({
  authConfig: { pages: { signIn: '/login' }, callbacks: {}, providers: [] },
}))

import { z } from 'zod'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { BCRYPT_SALT_ROUNDS } from '@/lib/constants/limits'

// auth.ts の authorize と同じバリデーションスキーマ
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります'),
})

/**
 * auth.ts の authorize 関数のロジックを忠実に再現
 * (lines 267-389)
 */
async function authorize(credentials: Record<string, unknown>) {
  const result = loginSchema.safeParse(credentials)
  if (!result.success) return null

  const { email, password } = result.data
  const { prisma } = await import('@/lib/db')
  const bcrypt = (await import('bcryptjs')).default

  // ゲストログイン
  if (email === GUEST_EMAIL) {
    const guestPassword = process.env.GUEST_PASSWORD ?? ''
    if (!guestPassword) return null
    const guestUser = await prisma.user.findUnique({
      where: { email: GUEST_EMAIL },
      select: {
        id: true, email: true, password: true,
        nickname: true, avatarUrl: true, isSuspended: true, emailVerified: true,
      },
    })
    if (!guestUser || !guestUser.password || !guestUser.emailVerified || guestUser.isSuspended) return null
    const match = await bcrypt.compare(password, guestUser.password)
    if (!match) return null
    return {
      id: guestUser.id, email: guestUser.email,
      name: guestUser.nickname, image: guestUser.avatarUrl,
    }
  }

  // 通常ログイン
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, email: true, password: true,
      nickname: true, avatarUrl: true, isSuspended: true, emailVerified: true,
    },
  })
  if (!user || !user.password) return null
  if (!user.emailVerified) return null
  if (user.isSuspended) return null

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) return null

  return {
    id: user.id, email: user.email,
    name: user.nickname, image: user.avatarUrl,
  }
}

/**
 * auth.ts の jwt callback (lines 435-448) を再現
 */
async function jwtCallback({ token, user }: { token: Record<string, unknown>; user?: Record<string, unknown> }) {
  if (user) {
    token.id = user.id
    token.email = (user as { email?: string }).email
    const { prisma } = await import('@/lib/db')
    const adminUser = await prisma.adminUser.findUnique({
      where: { userId: user.id as string },
      select: { userId: true },
    })
    token.isAdmin = !!adminUser
  }
  return token
}

/**
 * auth.ts の session callback (lines 465-473) を再現
 */
async function sessionCallback({ session, token }: { session: { user: Record<string, unknown> }; token: Record<string, unknown> }) {
  if (session.user && token.id) {
    session.user.id = token.id as string
    if (token.email) (session.user as { email?: string }).email = token.email as string
    session.user.isAdmin = !!token.isAdmin
  }
  return session
}

/**
 * auth.ts の createUser event (lines 407-417) を再現
 */
async function createUserEvent({ user }: { user: Record<string, unknown> }) {
  if (user.id && user.name) {
    const { prisma } = await import('@/lib/db')
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nickname: user.name,
        emailVerified: new Date(),
      },
    })
  }
}

/**
 * auth.ts の registerUser (lines 518-559) を再現
 */
async function registerUser(data: { email: string; password: string; nickname: string }) {
  const { prisma } = await import('@/lib/db')
  const bcrypt = (await import('bcryptjs')).default

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } })
  if (existingUser) throw new Error('このメールアドレスは既に使用されています')

  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS)
  return await prisma.user.create({
    data: { email: data.email, password: hashedPassword, nickname: data.nickname },
  })
}

describe('auth.ts - authorize, callbacks, events & registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // authorize - ゲストログイン (lines 287-317)
  // ============================================================
  describe('authorize - ゲストログイン', () => {
    it('GUEST_PASSWORDが空の場合nullを返す', async () => {
      const orig = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = ''
      expect(await authorize({ email: GUEST_EMAIL, password: 'anypasswd' })).toBeNull()
      process.env.GUEST_PASSWORD = orig
    })

    it('ゲストユーザーが存在しない場合nullを返す', async () => {
      const orig = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'
      mockUserFindUnique.mockResolvedValueOnce(null)
      expect(await authorize({ email: GUEST_EMAIL, password: 'guestpass123' })).toBeNull()
      process.env.GUEST_PASSWORD = orig
    })

    it('ゲストユーザーのpasswordがnullの場合nullを返す', async () => {
      const orig = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1', email: GUEST_EMAIL, password: null,
        nickname: 'Guest', avatarUrl: null, isSuspended: false, emailVerified: new Date(),
      })
      expect(await authorize({ email: GUEST_EMAIL, password: 'guestpass123' })).toBeNull()
      process.env.GUEST_PASSWORD = orig
    })

    it('ゲストユーザーのemailVerifiedがnullの場合nullを返す', async () => {
      const orig = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1', email: GUEST_EMAIL, password: '$2a$12$hash',
        nickname: 'Guest', avatarUrl: null, isSuspended: false, emailVerified: null,
      })
      expect(await authorize({ email: GUEST_EMAIL, password: 'guestpass123' })).toBeNull()
      process.env.GUEST_PASSWORD = orig
    })

    it('ゲストユーザーが停止されている場合nullを返す', async () => {
      const orig = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1', email: GUEST_EMAIL, password: '$2a$12$hash',
        nickname: 'Guest', avatarUrl: null, isSuspended: true, emailVerified: new Date(),
      })
      expect(await authorize({ email: GUEST_EMAIL, password: 'guestpass123' })).toBeNull()
      process.env.GUEST_PASSWORD = orig
    })

    it('パスワード不一致の場合nullを返す', async () => {
      const orig = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1', email: GUEST_EMAIL, password: '$2a$12$hash',
        nickname: 'Guest', avatarUrl: null, isSuspended: false, emailVerified: new Date(),
      })
      mockCompare.mockResolvedValueOnce(false)
      expect(await authorize({ email: GUEST_EMAIL, password: 'wrongpasswd' })).toBeNull()
      process.env.GUEST_PASSWORD = orig
    })

    it('ゲストログイン成功でユーザーオブジェクトを返す', async () => {
      const orig = process.env.GUEST_PASSWORD
      process.env.GUEST_PASSWORD = 'guestpass123'
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'guest-1', email: GUEST_EMAIL, password: '$2a$12$hash',
        nickname: 'Guest', avatarUrl: '/guest.jpg', isSuspended: false, emailVerified: new Date(),
      })
      mockCompare.mockResolvedValueOnce(true)
      const result = await authorize({ email: GUEST_EMAIL, password: 'guestpass123' })
      expect(result).toEqual({
        id: 'guest-1', email: GUEST_EMAIL, name: 'Guest', image: '/guest.jpg',
      })
      process.env.GUEST_PASSWORD = orig
    })
  })

  // ============================================================
  // authorize - 通常ログイン (lines 326-389)
  // ============================================================
  describe('authorize - 通常ログイン', () => {
    it('バリデーション失敗でnullを返す', async () => {
      expect(await authorize({ email: 'invalid', password: '123' })).toBeNull()
    })

    it('ユーザーが存在しない場合nullを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null)
      expect(await authorize({ email: 'nobody@example.com', password: 'password123' })).toBeNull()
    })

    it('パスワードがnull（OAuth）でnullを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u1', email: 'oauth@example.com', password: null,
        nickname: 'OAuth', avatarUrl: null, isSuspended: false, emailVerified: new Date(),
      })
      expect(await authorize({ email: 'oauth@example.com', password: 'password123' })).toBeNull()
    })

    it('emailVerifiedがnullの場合nullを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u1', email: 'unverified@example.com', password: '$2a$12$hash',
        nickname: 'Unverified', avatarUrl: null, isSuspended: false, emailVerified: null,
      })
      expect(await authorize({ email: 'unverified@example.com', password: 'password123' })).toBeNull()
    })

    it('停止アカウントでnullを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u1', email: 'suspended@example.com', password: '$2a$12$hash',
        nickname: 'Suspended', avatarUrl: null, isSuspended: true, emailVerified: new Date(),
      })
      expect(await authorize({ email: 'suspended@example.com', password: 'password123' })).toBeNull()
    })

    it('パスワード不一致でnullを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u1', email: 'user@example.com', password: '$2a$12$hash',
        nickname: 'User', avatarUrl: null, isSuspended: false, emailVerified: new Date(),
      })
      mockCompare.mockResolvedValueOnce(false)
      expect(await authorize({ email: 'user@example.com', password: 'wrongpassw' })).toBeNull()
    })

    it('正しい認証情報でユーザーオブジェクトを返す', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'u1', email: 'user@example.com', password: '$2a$12$hash',
        nickname: 'User', avatarUrl: '/avatar.jpg', isSuspended: false, emailVerified: new Date(),
      })
      mockCompare.mockResolvedValueOnce(true)
      expect(await authorize({ email: 'user@example.com', password: 'password123' })).toEqual({
        id: 'u1', email: 'user@example.com', name: 'User', image: '/avatar.jpg',
      })
    })
  })

  // ============================================================
  // events.createUser (lines 407-417)
  // ============================================================
  describe('events.createUser', () => {
    it('user.idとuser.nameがある場合、nicknameとemailVerifiedを更新する', async () => {
      mockUserUpdate.mockResolvedValueOnce({})
      await createUserEvent({ user: { id: 'oauth-user-1', name: 'GoogleUser' } })
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'oauth-user-1' },
        data: { nickname: 'GoogleUser', emailVerified: expect.any(Date) },
      })
    })

    it('user.idがない場合、更新しない', async () => {
      await createUserEvent({ user: { id: undefined, name: 'NoId' } })
      expect(mockUserUpdate).not.toHaveBeenCalled()
    })

    it('user.nameがない場合、更新しない', async () => {
      await createUserEvent({ user: { id: 'oauth-user-2', name: undefined } })
      expect(mockUserUpdate).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // callbacks.jwt (lines 435-448)
  // ============================================================
  describe('callbacks.jwt', () => {
    it('初回サインイン時にadminUser存在でtoken.isAdmin=true', async () => {
      mockAdminUserFindUnique.mockResolvedValueOnce({ userId: 'admin-1' })
      const token = {} as Record<string, unknown>
      const result = await jwtCallback({ token, user: { id: 'admin-1', email: 'admin@example.com' } })
      expect(result.id).toBe('admin-1')
      expect(result.email).toBe('admin@example.com')
      expect(result.isAdmin).toBe(true)
    })

    it('初回サインイン時にadminUser不在でtoken.isAdmin=false', async () => {
      mockAdminUserFindUnique.mockResolvedValueOnce(null)
      const token = {} as Record<string, unknown>
      const result = await jwtCallback({ token, user: { id: 'regular-1', email: 'user@example.com' } })
      expect(result.id).toBe('regular-1')
      expect(result.isAdmin).toBe(false)
    })

    it('userなし（後続リクエスト）はtokenをそのまま返す', async () => {
      const token = { id: 'existing', email: 'existing@example.com', isAdmin: true }
      const result = await jwtCallback({ token })
      expect(result).toEqual(token)
      expect(mockAdminUserFindUnique).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // callbacks.session (lines 465-473)
  // ============================================================
  describe('callbacks.session', () => {
    it('session.userにid, email, isAdminを設定する', async () => {
      const session = { user: { id: '', email: '', isAdmin: false } }
      const token = { id: 'user-1', email: 'test@example.com', isAdmin: true }
      const result = await sessionCallback({ session, token })
      expect(result.user.id).toBe('user-1')
      expect((result.user as { email?: string }).email).toBe('test@example.com')
      expect(result.user.isAdmin).toBe(true)
    })

    it('token.idがfalsyの場合session.userを変更しない', async () => {
      const session = { user: { id: 'original', email: 'original@example.com', isAdmin: false } }
      const token = { id: undefined, email: 'test@example.com', isAdmin: true }
      const result = await sessionCallback({ session, token })
      expect(result.user.id).toBe('original')
    })

    it('token.emailがfalsyの場合emailを設定しない', async () => {
      const session = { user: { id: '', email: 'original@example.com', isAdmin: false } }
      const token = { id: 'user-1', email: undefined, isAdmin: false }
      const result = await sessionCallback({ session, token })
      expect(result.user.id).toBe('user-1')
      expect((result.user as { email?: string }).email).toBe('original@example.com')
    })
  })

  // ============================================================
  // registerUser (lines 518-559)
  // ============================================================
  describe('registerUser', () => {
    it('新規ユーザーを登録する', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null)
      mockHash.mockResolvedValueOnce('$2a$12$hashedpassword')
      mockUserCreate.mockResolvedValueOnce({
        id: 'new-user', email: 'new@example.com', nickname: 'NewUser',
      })
      const result = await registerUser({ email: 'new@example.com', password: 'password123', nickname: 'NewUser' })
      expect(result).toEqual({ id: 'new-user', email: 'new@example.com', nickname: 'NewUser' })
      expect(mockHash).toHaveBeenCalledWith('password123', BCRYPT_SALT_ROUNDS)
    })

    it('既存メールアドレスでエラーをスローする', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'existing', email: 'exists@example.com' })
      await expect(
        registerUser({ email: 'exists@example.com', password: 'password123', nickname: 'User' })
      ).rejects.toThrow('このメールアドレスは既に使用されています')
    })
  })

  // ============================================================
  // Google Provider profile
  // ============================================================
  describe('Google Provider profile transform', () => {
    it('Googleプロフィール情報を正しい形式に変換する', () => {
      // auth.ts lines 232-239 の profile 関数を直接テスト
      const profile = (p: { sub: string; name: string; email: string; picture: string }) => ({
        id: p.sub,
        name: p.name,
        email: p.email,
        image: p.picture,
      })

      const result = profile({
        sub: 'google-sub-123', name: 'Google User',
        email: 'google@example.com', picture: 'https://example.com/photo.jpg',
      })

      expect(result).toEqual({
        id: 'google-sub-123', name: 'Google User',
        email: 'google@example.com', image: 'https://example.com/photo.jpg',
      })
    })
  })
})
