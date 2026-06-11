// @vitest-environment node

import { vi } from 'vitest'
describe('Security Logger Module', async () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeAll(() => {
    // vitest.setup.tsxのグローバルセットアップ後にスパイを設定
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('logLoginSuccess', async () => {
    it('ログイン成功を記録する', async () => {
      const { logLoginSuccess } = await import('@/lib/security-logger')
      logLoginSuccess('user-123', '192.168.1.1', 'Mozilla/5.0')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*LOGIN_SUCCESS.*user-123/)
      )
    })

    it('オプションのパラメータなしでも動作する', async () => {
      const { logLoginSuccess } = await import('@/lib/security-logger')
      logLoginSuccess('user-123')

      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })

  describe('logLoginFailure', async () => {
    it('ログイン失敗を記録する', async () => {
      const { logLoginFailure } = await import('@/lib/security-logger')
      logLoginFailure('test@example.com', '192.168.1.1', 'Invalid password')

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*LOGIN_FAILURE/)
      )
    })

    it('メールアドレスをマスキングして記録する', async () => {
      const { logLoginFailure } = await import('@/lib/security-logger')
      logLoginFailure('testuser@example.com', '192.168.1.1')

      const loggedMessage = consoleWarnSpy.mock.calls[0][0]
      expect(loggedMessage).not.toContain('testuser@example.com')
      expect(loggedMessage).toContain('t******r@example.com')
    })
  })

  describe('logLoginLockout', async () => {
    it('ロックアウトを高い重大度で記録する', async () => {
      const { logLoginLockout } = await import('@/lib/security-logger')
      logLoginLockout('test@example.com', '192.168.1.1')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*LOGIN_LOCKOUT/)
      )
    })
  })

  describe('logRegisterSuccess', async () => {
    it('ユーザー登録成功を記録する', async () => {
      const { logRegisterSuccess } = await import('@/lib/security-logger')
      logRegisterSuccess('new-user-id', '192.168.1.1')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*REGISTER_SUCCESS.*new-user-id/)
      )
    })
  })

  describe('logAdminAction', async () => {
    it('管理者アクションを記録する', async () => {
      const { logAdminAction } = await import('@/lib/security-logger')
      logAdminAction('admin-123', 'delete_user', 'user', 'target-user-id', { reason: 'spam' })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*ADMIN_ACTION.*delete_user/)
      )
    })

    it('詳細情報なしでも動作する', async () => {
      const { logAdminAction } = await import('@/lib/security-logger')
      logAdminAction('admin-123', 'view_logs')

      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })

  describe('logSuspiciousActivity', async () => {
    it('不審なアクティビティを高い重大度で記録する', async () => {
      const { logSuspiciousActivity } = await import('@/lib/security-logger')
      logSuspiciousActivity('Unusual request pattern', '192.168.1.1', 'user-456', { requestCount: 1000 })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*SUSPICIOUS_ACTIVITY.*Unusual request pattern/)
      )
    })
  })

  describe('logRateLimitExceeded', async () => {
    it('レート制限超過を記録する', async () => {
      const { logRateLimitExceeded } = await import('@/lib/security-logger')
      logRateLimitExceeded('api', '192.168.1.1', 'user-789')

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*RATE_LIMIT_EXCEEDED/)
      )
    })
  })

  describe('logInvalidInput', async () => {
    it('不正な入力を記録する', async () => {
      const { logInvalidInput } = await import('@/lib/security-logger')
      logInvalidInput('email', 'XSS pattern detected', '192.168.1.1', 'user-123')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*INVALID_INPUT/)
      )
    })
  })

  describe('logUnauthorizedAccess', async () => {
    it('権限のないアクセスを高い重大度で記録する', async () => {
      const { logUnauthorizedAccess } = await import('@/lib/security-logger')
      logUnauthorizedAccess('/admin/dashboard', '192.168.1.1', 'user-456')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*UNAUTHORIZED_ACCESS.*\/admin\/dashboard/)
      )
    })
  })

  describe('logPasswordResetRequest', async () => {
    it('パスワードリセットリクエストを記録する', async () => {
      const { logPasswordResetRequest } = await import('@/lib/security-logger')
      logPasswordResetRequest('user@example.com', '192.168.1.1')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*PASSWORD_RESET_REQUEST/)
      )
    })

    it('メールアドレスをマスキングして記録する', async () => {
      const { logPasswordResetRequest } = await import('@/lib/security-logger')
      logPasswordResetRequest('john@example.com', '192.168.1.1')

      const loggedMessage = consoleLogSpy.mock.calls[0][0]
      expect(loggedMessage).not.toContain('john@example.com')
      expect(loggedMessage).toContain('j**n@example.com')
    })
  })

  describe('logPasswordResetSuccess', async () => {
    it('パスワードリセット成功を記録する', async () => {
      const { logPasswordResetSuccess } = await import('@/lib/security-logger')
      logPasswordResetSuccess('user-123', '192.168.1.1')

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[SECURITY\].*PASSWORD_RESET_SUCCESS.*user-123/)
      )
    })
  })

  describe('Email Masking', async () => {
    it('短いローカル部（2文字以下）は完全にマスキングする', async () => {
      const { logLoginFailure } = await import('@/lib/security-logger')
      logLoginFailure('ab@example.com', '192.168.1.1')

      const loggedMessage = consoleWarnSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('**@example.com')
    })

    it('1文字のローカル部もマスキングする', async () => {
      const { logLoginFailure } = await import('@/lib/security-logger')
      logLoginFailure('a@example.com', '192.168.1.1')

      const loggedMessage = consoleWarnSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('*@example.com')
    })

    it('不正な形式のメールは完全にマスキングする', async () => {
      const { logLoginFailure } = await import('@/lib/security-logger')
      logLoginFailure('invalid-email', '192.168.1.1')

      const loggedMessage = consoleWarnSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('***@***')
    })
  })

  describe('Log Format', async () => {
    it('タイムスタンプを含む', async () => {
      const { logLoginSuccess } = await import('@/lib/security-logger')
      logLoginSuccess('user-123')

      const loggedMessage = consoleLogSpy.mock.calls[0][0]
      expect(loggedMessage).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('環境変数を含む', async () => {
      const { logLoginSuccess } = await import('@/lib/security-logger')
      logLoginSuccess('user-123')

      const loggedMessage = consoleLogSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('"env":')
      expect(loggedMessage).toContain('"app":"bon-log"')
    })

    it('重大度を含む', async () => {
      const { logLoginSuccess } = await import('@/lib/security-logger')
      logLoginSuccess('user-123')

      const loggedMessage = consoleLogSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('"severity":"low"')
    })
  })

  describe('Security Sinks', async () => {
    beforeEach(async () => {
      const { _clearSecuritySinksForTest } = await import('@/lib/security-logger')
      _clearSecuritySinksForTest()
    })

    it('登録した sink にエントリと整形済み JSON を渡す', async () => {
      const { registerSecuritySink, logLoginSuccess } = await import('@/lib/security-logger')
      const sink = vi.fn()
      registerSecuritySink(sink)

      logLoginSuccess('user-abc')

      expect(sink).toHaveBeenCalledTimes(1)
      const call = sink.mock.calls[0]
      expect(call).toBeDefined()
      const [entry, formatted] = call!
      expect(entry).toMatchObject({
        type: 'LOGIN_SUCCESS',
        userId: 'user-abc',
        severity: 'low',
      })
      expect(typeof formatted).toBe('string')
      expect(JSON.parse(formatted)).toMatchObject({
        type: 'LOGIN_SUCCESS',
        userId: 'user-abc',
        app: 'bon-log',
      })
    })

    it('登録解除関数を呼ぶと該当 sink だけ取り除く', async () => {
      const { registerSecuritySink, logLoginSuccess } = await import('@/lib/security-logger')
      const sinkA = vi.fn()
      const sinkB = vi.fn()
      const unregisterA = registerSecuritySink(sinkA)
      registerSecuritySink(sinkB)

      unregisterA()
      logLoginSuccess('user-1')

      expect(sinkA).not.toHaveBeenCalled()
      expect(sinkB).toHaveBeenCalledTimes(1)
    })

    it('同じ unregister を2回呼んでも他の sink を巻き込まない', async () => {
      const { registerSecuritySink, logLoginSuccess } = await import('@/lib/security-logger')
      const sinkA = vi.fn()
      const sinkB = vi.fn()
      const unregisterA = registerSecuritySink(sinkA)
      registerSecuritySink(sinkB)

      unregisterA()
      unregisterA()
      logLoginSuccess('user-1')

      expect(sinkB).toHaveBeenCalledTimes(1)
    })

    it('sink が同期例外を投げても他の sink と呼び出し元に影響しない', async () => {
      const { registerSecuritySink, logLoginSuccess } = await import('@/lib/security-logger')
      const throwingSink = vi.fn(() => {
        throw new Error('sink fails')
      })
      const followingSink = vi.fn()
      registerSecuritySink(throwingSink)
      registerSecuritySink(followingSink)

      expect(() => logLoginSuccess('user-1')).not.toThrow()
      expect(throwingSink).toHaveBeenCalledTimes(1)
      expect(followingSink).toHaveBeenCalledTimes(1)
    })

    it('async sink が reject しても呼び出し元に伝播しない', async () => {
      const { registerSecuritySink, logLoginSuccess } = await import('@/lib/security-logger')
      const rejectingSink = vi.fn(() => Promise.reject(new Error('async failure')))
      registerSecuritySink(rejectingSink)

      expect(() => logLoginSuccess('user-1')).not.toThrow()
      // 非同期 reject の握りつぶしを保証するため、microtask flush を待つ
      await Promise.resolve()
      await Promise.resolve()
      expect(rejectingSink).toHaveBeenCalledTimes(1)
    })

    it('複数 sink は登録順に呼び出される', async () => {
      const { registerSecuritySink, logLoginSuccess } = await import('@/lib/security-logger')
      const order: string[] = []
      registerSecuritySink(() => {
        order.push('first')
      })
      registerSecuritySink(() => {
        order.push('second')
      })

      logLoginSuccess('user-1')

      expect(order).toEqual(['first', 'second'])
    })

    it('_clearSecuritySinksForTest で登録済み sink を全削除する', async () => {
      const { registerSecuritySink, _clearSecuritySinksForTest, logLoginSuccess } = await import(
        '@/lib/security-logger'
      )
      const sink = vi.fn()
      registerSecuritySink(sink)

      _clearSecuritySinksForTest()
      logLoginSuccess('user-1')

      expect(sink).not.toHaveBeenCalled()
    })

    it('sync sink が void を返した場合に .catch を呼ばずに完了する', async () => {
      const { registerSecuritySink, logLoginSuccess } = await import('@/lib/security-logger')
      const sink = vi.fn(() => undefined)
      registerSecuritySink(sink)

      expect(() => logLoginSuccess('user-1')).not.toThrow()
      expect(sink).toHaveBeenCalledTimes(1)
    })

    it('high 重大度のイベントも sink に届く', async () => {
      const { registerSecuritySink, logUnauthorizedAccess } = await import('@/lib/security-logger')
      const sink = vi.fn()
      registerSecuritySink(sink)

      logUnauthorizedAccess('/admin', '127.0.0.1', 'user-1')

      expect(sink).toHaveBeenCalledTimes(1)
      expect(sink.mock.calls[0]![0]).toMatchObject({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'high',
      })
    })
  })
})
