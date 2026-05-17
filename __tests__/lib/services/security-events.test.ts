// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSecurityEventCreate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    securityEvent: {
      create: (...args: unknown[]) => mockSecurityEventCreate(...args),
    },
  },
}))

describe('logSecurityEvent', () => {
  beforeEach(() => {
    mockSecurityEventCreate.mockReset()
    mockSecurityEventCreate.mockResolvedValue(undefined)
  })

  it('全フィールド指定時はそのまま永続化する', async () => {
    const { logSecurityEvent } = await import('@/lib/services/security-events')

    await logSecurityEvent({
      eventType: 'login_success',
      userId: 'user-1',
      ipAddress: '203.0.113.5',
      userAgent: 'Mozilla/5.0',
      details: { factor: '2fa' },
    })

    expect(mockSecurityEventCreate).toHaveBeenCalledWith({
      data: {
        eventType: 'login_success',
        userId: 'user-1',
        ipAddress: '203.0.113.5',
        userAgent: 'Mozilla/5.0',
        details: { factor: '2fa' },
      },
    })
  })

  it('userId / ipAddress / userAgent が undefined の場合は null で保存する', async () => {
    const { logSecurityEvent } = await import('@/lib/services/security-events')

    await logSecurityEvent({ eventType: 'login_failed' })

    expect(mockSecurityEventCreate).toHaveBeenCalledWith({
      data: {
        eventType: 'login_failed',
        userId: null,
        ipAddress: null,
        userAgent: null,
        details: undefined,
      },
    })
  })

  it('details は JSON 経由でディープクローンされる（参照を共有しない）', async () => {
    const { logSecurityEvent } = await import('@/lib/services/security-events')

    const original = { nested: { reason: 'invalid_password' } }
    await logSecurityEvent({ eventType: 'login_failed', details: original })

    const passedDetails = mockSecurityEventCreate.mock.calls[0]?.[0]?.data?.details
    expect(passedDetails).toEqual({ nested: { reason: 'invalid_password' } })
    // ディープクローン: ネストオブジェクトの参照も別物になっている
    expect(passedDetails.nested).not.toBe(original.nested)

    // 後から元を変更しても保存値は変わらない
    original.nested.reason = 'mutated'
    expect(passedDetails.nested.reason).toBe('invalid_password')
  })

  it('JSON.stringify で消える値（function / undefined）は欠落する', async () => {
    const { logSecurityEvent } = await import('@/lib/services/security-events')

    await logSecurityEvent({
      eventType: 'test',
      details: {
        keep: 'value',
        // eslint.config.mjs でテストファイルは @typescript-eslint/no-explicit-any を off にしているため
        // disable コメントは不要（unused-directive 警告を避ける）
        skip: undefined as any,
        fn: (() => 1) as any,
      },
    })

    const passedDetails = mockSecurityEventCreate.mock.calls[0]?.[0]?.data?.details
    expect(passedDetails).toEqual({ keep: 'value' })
  })

  it('details が未指定なら undefined のまま渡され Prisma 側のデフォルトに任せる', async () => {
    const { logSecurityEvent } = await import('@/lib/services/security-events')

    await logSecurityEvent({ eventType: 'password_change', userId: 'u1' })

    expect(mockSecurityEventCreate.mock.calls[0]?.[0]?.data?.details).toBeUndefined()
  })

  it('Prisma エラーは呼び出し元に伝播する（呼び出し元で捕捉される設計）', async () => {
    mockSecurityEventCreate.mockRejectedValueOnce(new Error('db down'))
    const { logSecurityEvent } = await import('@/lib/services/security-events')

    await expect(logSecurityEvent({ eventType: 'login_failed' })).rejects.toThrow('db down')
  })
})
