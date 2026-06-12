// @vitest-environment node
/**
 * POST /api/v1/auth/logout のユニットテスト
 *
 * 冪等設計（不存在・失効済みでも 200）と正常 revoke を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRefreshTokenUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
const mockPrisma = {
  refreshToken: {
    updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

function makeLogoutRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/logout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshTokenUpdateMany.mockResolvedValue({ count: 0 })
  })

  it('有効なトークンで 200 { success: true } を返す', async () => {
    mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 1 })

    const { POST } = await import('@/app/api/v1/auth/logout/route')
    const res = await POST(makeLogoutRequest({ refreshToken: 'valid-refresh-token' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ revokedAt: null }),
        data: { revokedAt: expect.any(Date) },
      })
    )
  })

  it('存在しないトークンでも 200 （冪等）', async () => {
    mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 0 })

    const { POST } = await import('@/app/api/v1/auth/logout/route')
    const res = await POST(makeLogoutRequest({ refreshToken: 'nonexistent-token' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('失効済みトークンでも 200 （冪等）', async () => {
    mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 0 })

    const { POST } = await import('@/app/api/v1/auth/logout/route')
    const res = await POST(makeLogoutRequest({ refreshToken: 'already-revoked-token' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('refreshToken フィールド欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/logout/route')
    const res = await POST(makeLogoutRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/logout', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/logout/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('同じトークンで 2 回ログアウトしても 2 回目も 200 （冪等）', async () => {
    const { POST } = await import('@/app/api/v1/auth/logout/route')

    const res1 = await POST(makeLogoutRequest({ refreshToken: 'repeat-token' }))
    const res2 = await POST(makeLogoutRequest({ refreshToken: 'repeat-token' }))

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
  })
})
