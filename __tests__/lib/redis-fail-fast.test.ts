/**
 * production 環境で Redis 未設定なら fail-fast する回帰テスト (P1-4)。
 *
 * - VERCEL_ENV=production: 必須
 * - NODE_ENV=production かつ NEXT_PUBLIC_APP_URL が non-loopback: 必須
 * - loopback URL (CI / E2E / Lighthouse): 例外的に in-memory fallback 許容
 * - development / test: in-memory fallback 許容
 */
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assertRedisConfiguredInProduction, isRedisConfigured } from '@/lib/redis'

describe('assertRedisConfiguredInProduction', () => {
  const origEnv = process.env

  beforeEach(() => {
    process.env = { ...origEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.VERCEL_ENV
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    process.env = origEnv
  })

  it('development では Redis 未設定でも throw しない', () => {
    expect(() => assertRedisConfiguredInProduction()).not.toThrow()
  })

  it('NODE_ENV=production + loopback URL なら CI 互換で throw しない', () => {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    expect(() => assertRedisConfiguredInProduction()).not.toThrow()
  })

  it('VERCEL_ENV=production は loopback でも throw', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    expect(() => assertRedisConfiguredInProduction()).toThrow(/UPSTASH/)
  })

  it('NODE_ENV=production + non-loopback URL なら throw', () => {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    expect(() => assertRedisConfiguredInProduction()).toThrow(/UPSTASH/)
  })

  it('NODE_ENV=production で NEXT_PUBLIC_APP_URL 未設定なら throw', () => {
    process.env.NODE_ENV = 'production'
    expect(() => assertRedisConfiguredInProduction()).toThrow(/UPSTASH/)
  })

  it('Upstash 設定済みなら production でも throw しない', () => {
    process.env.NODE_ENV = 'production'
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example/redis'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    expect(() => assertRedisConfiguredInProduction()).not.toThrow()
  })

  it('isRedisConfigured は両方の env を必要とする', () => {
    expect(isRedisConfigured()).toBe(false)
    process.env.UPSTASH_REDIS_REST_URL = 'https://example/redis'
    expect(isRedisConfigured()).toBe(false)
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    expect(isRedisConfigured()).toBe(true)
  })
})
