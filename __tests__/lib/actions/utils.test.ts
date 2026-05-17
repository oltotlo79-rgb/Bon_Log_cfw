// @vitest-environment node

import { vi } from 'vitest'
export {} // TypeScriptモジュールとして扱うための空エクスポート

// Prismaモック
const mockPrisma = {
  adminUser: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// headersモック
const mockHeadersGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockHeadersGet(...args),
  }),
}))

// レート制限モック（requireActiveUser からの呼び出しで使われる）
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

describe('Utils Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // requireAuth
  // ============================================================

  describe('requireAuth', async () => {
    it('認証済みの場合はuserIdを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      const { requireAuth } = await import('@/lib/actions/utils')
      const result = await requireAuth()

      expect(result).toEqual({ userId: 'user-1' })
    })

    it('未認証の場合はerrorを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { requireAuth } = await import('@/lib/actions/utils')
      const result = await requireAuth()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('セッションにユーザーIDがない場合はerrorを返す', async () => {
      mockAuth.mockResolvedValue({ user: {} })
      const { requireAuth } = await import('@/lib/actions/utils')
      const result = await requireAuth()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('セッションにuserがない場合はerrorを返す', async () => {
      mockAuth.mockResolvedValue({})
      const { requireAuth } = await import('@/lib/actions/utils')
      const result = await requireAuth()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // requireNotGuest
  // ============================================================

  describe('requireNotGuest', async () => {
    it('ゲスト（GUEST_EMAIL）の場合はerrorを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })
      const { requireNotGuest } = await import('@/lib/actions/utils')
      const result = await requireNotGuest()

      expect(result).toMatchObject({ error: ERR_GUEST_CANNOT_CREATE })
    })

    it('通常ユーザー（emailがGUEST_EMAILでない）の場合はnullを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
      const { requireNotGuest } = await import('@/lib/actions/utils')
      const result = await requireNotGuest()

      expect(result).toBeNull()
    })

    it('未認証の場合はnullを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { requireNotGuest } = await import('@/lib/actions/utils')
      const result = await requireNotGuest()

      expect(result).toBeNull()
    })
  })

  // ============================================================
  // requireAdmin
  // ============================================================

  describe('requireAdmin', async () => {
    it('管理者の場合はuserIdとroleを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'admin' })
      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect(result).toEqual({ userId: 'admin-1', role: 'admin' })
    })

    it('未認証の場合はerrorを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はerrorを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('prisma.adminUser.findUniqueを正しいパラメータで呼び出す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'superadmin' })
      const { requireAdmin } = await import('@/lib/actions/utils')
      await requireAdmin()

      expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { userId: 'admin-1' },
        select: { role: true },
      })
    })

    it('停止中の管理者は ERR_ACCOUNT_SUSPENDED を返す (DB suspended check)', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'admin' })
      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect(result).toMatchObject({ error: 'アカウントが停止されています' })
      // adminUser.findUnique は active 確認後に呼ぶ設計 (停止中なら呼ばれない)
      expect(mockPrisma.adminUser.findUnique).not.toHaveBeenCalled()
    })

    it('active な管理者は user/adminUser の両方を確認する (fresh DB check)', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'admin' })
      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect(result).toEqual({ userId: 'admin-1', role: 'admin' })
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        select: { isSuspended: true },
      })
    })
  })

  // ============================================================
  // getClientIp
  // ============================================================

  describe('getClientIp', async () => {
    it('cf-connecting-ipヘッダーがある場合はそのIPを返す', async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return '1.2.3.4'
        return null
      })
      const { getClientIp } = await import('@/lib/actions/utils')
      const ip = await getClientIp()

      expect(ip).toBe('1.2.3.4')
    })

    it('x-forwarded-forヘッダーがある場合は最初のIPを返す', async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return null
        if (name === 'x-forwarded-for') return '5.6.7.8, 9.10.11.12'
        return null
      })
      const { getClientIp } = await import('@/lib/actions/utils')
      const ip = await getClientIp()

      expect(ip).toBe('5.6.7.8')
    })

    it('x-real-ipヘッダーがある場合はそのIPを返す', async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return null
        if (name === 'x-forwarded-for') return null
        if (name === 'x-real-ip') return '13.14.15.16'
        return null
      })
      const { getClientIp } = await import('@/lib/actions/utils')
      const ip = await getClientIp()

      expect(ip).toBe('13.14.15.16')
    })

    it('ヘッダーがない場合はunknownを返す', async () => {
      mockHeadersGet.mockReturnValue(null)
      const { getClientIp } = await import('@/lib/actions/utils')
      const ip = await getClientIp()

      expect(ip).toBe('unknown')
    })
  })

  // ============================================================
  // getStartOfToday
  // ============================================================

  describe('getStartOfToday', async () => {
    it('今日の0時0分0秒のDateを返す', async () => {
      const { getStartOfToday } = await import('@/lib/utils')
      const result = getStartOfToday()

      const expected = new Date()
      expected.setHours(0, 0, 0, 0)

      expect(result.getTime()).toBe(expected.getTime())
    })

    it('返り値はDateオブジェクトである', async () => {
      const { getStartOfToday } = await import('@/lib/utils')
      const result = getStartOfToday()

      expect(result).toBeInstanceOf(Date)
    })

    it('時刻部分が全て0である', async () => {
      const { getStartOfToday } = await import('@/lib/utils')
      const result = getStartOfToday()

      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
    })
  })

  // ============================================================
  // ActionResult型
  // ============================================================

  describe('ActionResult型の使用例', () => {
    it('成功時の型判定', async () => {
      // ActionResultの型テスト: success: true, data付き
      type ActionResult<T = void> =
        | { success: true; data?: T }
        | { success: false; error: string }

      const result: ActionResult<{ id: string }> = { success: true, data: { id: '1' } }

      if (result.success) {
        expect(result.data).toEqual({ id: '1' })
      }
    })

    it('失敗時の型判定', async () => {
      type ActionResult<T = void> =
        | { success: true; data?: T }
        | { success: false; error: string }

      const result: ActionResult = { success: false, error: 'エラー' }

      if (!result.success) {
        expect(result.error).toBe('エラー')
      }
    })
  })

  // ============================================================
  // withActionErrorHandler
  // ============================================================

  describe('withActionErrorHandler', () => {
    it('fn が成功した場合、その戻り値をそのまま返す', async () => {
      const { withActionErrorHandler } = await import('@/lib/actions/utils')
      const result = await withActionErrorHandler(
        { name: 'testAction', fallbackError: 'FALLBACK' },
        async () => ({ success: true, data: { id: 'x' } }),
      )
      expect(result).toEqual({ success: true, data: { id: 'x' } })
    })

    it('fn が actionError 風の失敗を返した場合、そのまま伝搬する（throw されない場合は fallback されない）', async () => {
      const { withActionErrorHandler } = await import('@/lib/actions/utils')
      const result = await withActionErrorHandler(
        { name: 'testAction', fallbackError: 'FALLBACK' },
        async () => ({ success: false, error: 'validation failed' }),
      )
      expect(result).toEqual({ success: false, error: 'validation failed' })
    })

    it('fn が Error を throw した場合、fallbackError を返す', async () => {
      const { withActionErrorHandler } = await import('@/lib/actions/utils')
      const result = await withActionErrorHandler(
        { name: 'testAction', fallbackError: 'FALLBACK_ERROR' },
        async () => {
          throw new Error('boom')
        },
      )
      expect(result).toEqual({ success: false, error: 'FALLBACK_ERROR' })
    })

    it('fn が非 Error を throw した場合も fallbackError を返す（String 変換される）', async () => {
      const { withActionErrorHandler } = await import('@/lib/actions/utils')
      const result = await withActionErrorHandler(
        { name: 'testAction', fallbackError: 'FALLBACK_ERROR' },
        async () => {
          throw 'string error'
        },
      )
      expect(result).toEqual({ success: false, error: 'FALLBACK_ERROR' })
    })

    it('context が指定された場合も fallback 挙動は同じ（ログ送出の副作用のみ）', async () => {
      const { withActionErrorHandler } = await import('@/lib/actions/utils')
      const result = await withActionErrorHandler(
        { name: 'testAction', fallbackError: 'FALLBACK_ERROR', context: { userId: 'u1' } },
        async () => {
          throw new Error('with context')
        },
      )
      expect(result).toEqual({ success: false, error: 'FALLBACK_ERROR' })
    })
  })

  // ============================================================
  // requireActiveNonGuestUser
  // ============================================================

  describe('requireActiveNonGuestUser', () => {
    it('未認証の場合は認証エラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser('post')
      expect('error' in result).toBe(true)
    })

    it('ゲスト（GUEST_EMAIL）の場合はゲスト拒否エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser('post')
      expect(result).toMatchObject({ error: ERR_GUEST_CANNOT_CREATE })
    })

    it('停止されたユーザーはアカウント停止エラーを返す', async () => {
      const { ERR_ACCOUNT_SUSPENDED } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser('post')
      expect(result).toMatchObject({ error: ERR_ACCOUNT_SUSPENDED })
    })

    it('アクティブな非ゲストユーザーの場合は userId を返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser('post')
      expect(result).toEqual({ userId: 'u1' })
    })
  })
})
