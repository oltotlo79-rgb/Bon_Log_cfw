/**
 * Redis アクセス層。本番は Upstash Redis、未設定時はインメモリに自動フォールバック。
 *
 * @module lib/redis
 */

import { Redis } from '@upstash/redis'
import { IN_MEMORY_CLEANUP_THRESHOLD } from '@/lib/constants/limits'
import logger from '@/lib/logger'

/**
 * アプリから使う Redis 風のストア。
 * 実装を差し替えやすくするため最小限のメソッドだけを定義する。
 */
interface RedisLikeStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { ex?: number }): Promise<void>
  del(key: string): Promise<void>
  /** 値を 1 増やして返す。キーが無ければ 1 から開始。 */
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<void>
  /** 残り TTL（秒）。`-1` は無期限、`-2` はキーなし/期限切れ。 */
  ttl(key: string): Promise<number>
}

/**
 * 開発/テスト/Redis 未設定時のフォールバック。
 * プロセス内 Map に保持するためインスタンス間では共有されない。
 */
class InMemoryStore implements RedisLikeStore {
  private store = new Map<string, { value: string; expiresAt: number | null }>()

  /** 期限切れエントリをまとめて掃除してメモリリークを防ぐ。 */
  private cleanExpired() {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key)
      }
    }
  }

  private static CLEANUP_THRESHOLD = IN_MEMORY_CLEANUP_THRESHOLD

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    if (this.store.size > InMemoryStore.CLEANUP_THRESHOLD) {
      this.cleanExpired()
    }
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null
    this.store.set(key, { value, expiresAt })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key)
    const currentValue = entry ? parseInt(entry.value, 10) || 0 : 0
    const newValue = currentValue + 1
    this.store.set(key, { value: newValue.toString(), expiresAt: entry?.expiresAt ?? null })
    return newValue
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry || !entry.expiresAt) return -1
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  }
}

/** Upstash Redis（HTTP REST）を使う本番実装。 */
class UpstashRedisStore implements RedisLikeStore {
  private client: Redis

  constructor(url: string, token: string) {
    this.client = new Redis({
      url,
      token,
    })
  }

  async get(key: string): Promise<string | null> {
    const result = await this.client.get<string>(key)
    return result
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    if (options?.ex) {
      await this.client.set(key, value, { ex: options.ex })
    } else {
      await this.client.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key)
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds)
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key)
  }
}

let redisClient: RedisLikeStore | null = null

/** Upstash Redis の REST URL / token が両方設定されているか確認する。 */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * 実 production deploy 上で Redis 未設定の場合に throw する。
 *
 * Why: in-memory fallback は単一プロセス前提のため、Vercel / serverless 上で
 * 複数 instance に水平分散するとレート制限・dedupe・ロック等が
 * instance ローカルになり攻撃検知やべき等性が崩れる。
 * 起動時に明示エラーで気付かせる方が安全。
 *
 * 「実 production deploy」の判定:
 *   - VERCEL_ENV === 'production' なら確実に Vercel 上の本番 deploy
 *   - VERCEL_ENV が未設定で NODE_ENV === 'production' かつ
 *     NEXT_PUBLIC_APP_URL が loopback でない場合も本番扱い
 *   - CI E2E / Lighthouse は NODE_ENV=production でも localhost を使うため除外
 */
export function assertRedisConfiguredInProduction(): void {
  if (isRedisConfigured()) return
  if (process.env.VERCEL_ENV === 'production') {
    throwRedisMissing()
  }
  if (process.env.NODE_ENV !== 'production') return
  // VERCEL_ENV が未設定で NODE_ENV=production の場合、loopback (CI) は除外する
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throwRedisMissing()
  }
  try {
    const hostname = new URL(appUrl).hostname
    const isLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]'
    if (!isLoopback) {
      throwRedisMissing()
    }
  } catch {
    throwRedisMissing()
  }
}

function throwRedisMissing(): never {
  throw new Error(
    '[FATAL] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が未設定です。' +
      'production では in-memory fallback を許容しません ' +
      '(serverless 上で instance 局所化したレート制限は防御を成立させないため)。',
  )
}

/**
 * プロセス共有の Redis クライアントを返す（シングルトン）。
 * `UPSTASH_REDIS_REST_URL` と `UPSTASH_REDIS_REST_TOKEN` の両方が揃っていれば Upstash、
 * それ以外はインメモリにフォールバックする。
 *
 * production で未設定の場合は `assertRedisConfiguredInProduction` で
 * 早期に throw する (instrumentation で検知できなかった場合の保険)。
 */
export function getRedisClient(): RedisLikeStore {
  if (redisClient) return redisClient

  assertRedisConfiguredInProduction()

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (redisUrl && redisToken) {
    logger.log('Using Upstash Redis')
    redisClient = new UpstashRedisStore(redisUrl, redisToken)
  } else {
    logger.log('Using in-memory store (Redis not configured)')
    redisClient = new InMemoryStore()
  }

  return redisClient
}

/** 遅延初期化されたクライアントへの薄いプロキシ。 */
export const redis = {
  get client() {
    return getRedisClient()
  },
}
