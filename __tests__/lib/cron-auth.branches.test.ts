/**
 * cron-auth - 分岐テスト
 *
 * Bearer / HMAC 両方の認証を環境別に検証する。
 * Bearer は Vercel Cron の標準仕様 (production 含む全環境で許可)、
 * HMAC は外部スケジューラ用 (リプレイ攻撃耐性)。
 */

import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest'

describe('cron-auth - 環境別 Bearer / HMAC 分岐', () => {
  const TEST_SECRET = 'test-cron-secret-12345'
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    process.env.CRON_SECRET = TEST_SECRET
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('本番環境でも Bearer 認証 (タイムスタンプなし) を許可する (Vercel Cron 互換)', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    const { verifyCronAuth } = await import('@/lib/cron-auth')
    const result = verifyCronAuth(`Bearer ${TEST_SECRET}`, null)

    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('非 production でも Bearer 認証 (タイムスタンプなし) を許可する', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'

    const { verifyCronAuth } = await import('@/lib/cron-auth')
    const result = verifyCronAuth(`Bearer ${TEST_SECRET}`, null)

    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('DISABLE_LEGACY_CRON_AUTH=true のとき Bearer をスキップして HMAC 認証を要求する', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    process.env.DISABLE_LEGACY_CRON_AUTH = 'true'

    const { verifyCronAuth } = await import('@/lib/cron-auth')
    const result = verifyCronAuth(`Bearer ${TEST_SECRET}`, null)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid authorization scheme')
  })

  it('Bearer トークンの長さが異なる場合は拒否する (timing-safe compare)', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    const { verifyCronAuth } = await import('@/lib/cron-auth')
    const result = verifyCronAuth('Bearer short', null)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid authorization scheme')
  })

  it('Bearer プレフィックスのみで秘密値が空でも拒否する', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    const { verifyCronAuth } = await import('@/lib/cron-auth')
    const result = verifyCronAuth('Bearer ', null)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid authorization scheme')
  })

  it('pathname 付き HMAC 署名で認証成功する', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'

    const { verifyCronAuth, generateCronSignature } = await import('@/lib/cron-auth')
    const timestamp = Date.now().toString()
    const pathname = '/api/cron/cleanup'
    const signature = generateCronSignature(timestamp, TEST_SECRET, pathname)

    const result = verifyCronAuth(`HMAC ${signature}`, timestamp, pathname)

    expect(result.valid).toBe(true)
  })

  it('pathname が異なると署名検証に失敗する', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'

    const { verifyCronAuth, generateCronSignature } = await import('@/lib/cron-auth')
    const timestamp = Date.now().toString()
    const signature = generateCronSignature(timestamp, TEST_SECRET, '/api/cron/cleanup')

    const result = verifyCronAuth(`HMAC ${signature}`, timestamp, '/api/cron/other')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid signature')
  })
})
