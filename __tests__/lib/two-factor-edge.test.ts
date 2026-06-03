// @vitest-environment node
/**
 * two-factor.ts の未カバーブランチ補完
 *
 * 既存テストでカバー漏れの分岐:
 * - getCurrentKeyVersion: 不正な TWO_FACTOR_KEY_VERSION を投入した場合の throw
 * - getEncryptionKey: 不正な version 文字列を含む暗号文の decrypt 時 throw
 * - getEncryptionKey: 単一鍵が無く v1 でも別バージョンでも鍵が無いケース
 * - verifyBackupCode: 長さ不一致ハッシュ・undefined 要素・順位の安定性
 * - decryptSecret: バージョンプレフィックスの判別境界 (`:` が先頭、`x:` で pattern 不一致)
 * - migrateToCurrentKeyVersion: 旧鍵 → 現行鍵への移行とno-opケース
 * - verifyTOTP: otp.verify が throw した場合の catch
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.unmock('@/lib/two-factor')

const KEY_V1 = 'a'.repeat(64)
const KEY_V2 = 'b'.repeat(64)

beforeEach(() => {
  vi.resetModules()
  delete process.env.TWO_FACTOR_KEY_VERSION
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v1
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v2
  process.env.TWO_FACTOR_ENCRYPTION_KEY = KEY_V1
})

afterEach(() => {
  delete process.env.TWO_FACTOR_KEY_VERSION
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v1
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v2
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY
})

describe('getCurrentKeyVersion (encryptSecret 経由)', () => {
  it('不正な TWO_FACTOR_KEY_VERSION が設定されているとエラーをスローする', async () => {
    process.env.TWO_FACTOR_KEY_VERSION = 'invalid-version'
    const { encryptSecret } = await import('@/lib/two-factor')

    expect(() => encryptSecret('SECRET')).toThrow(/Invalid TWO_FACTOR_KEY_VERSION/)
  })

  it('TWO_FACTOR_KEY_VERSION=va のような prefix 不一致は throw する', async () => {
    process.env.TWO_FACTOR_KEY_VERSION = 'va'
    const { encryptSecret } = await import('@/lib/two-factor')

    expect(() => encryptSecret('SECRET')).toThrow(/Invalid TWO_FACTOR_KEY_VERSION/)
  })
})

describe('decryptSecret (バージョンプレフィックス境界)', () => {
  it('"x:base64..." のように pattern 不一致なら旧形式(v1)として復号を試みる', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/two-factor')
    const encrypted = encryptSecret('SECRET')
    // "v1:" を "xyz:" に置き換えて pattern 不一致をシミュレート
    const tampered = encrypted.replace(/^v1:/, 'xyz:')

    // hasVersionPrefix=false 経由で v1 鍵にフォールバック → AES-GCM の auth tag 検証で失敗
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('先頭が ":" だけの不正フォーマットも v1 として扱う', async () => {
    const { decryptSecret } = await import('@/lib/two-factor')
    expect(() => decryptSecret(':notbase64')).toThrow()
  })

  it('v2 で暗号化された値を v1 鍵環境で復号しようとすると失敗する', async () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY_v1 = KEY_V1
    process.env.TWO_FACTOR_ENCRYPTION_KEY_v2 = KEY_V2
    process.env.TWO_FACTOR_KEY_VERSION = 'v2'
    const { encryptSecret } = await import('@/lib/two-factor')
    const encryptedV2 = encryptSecret('SECRET')

    // v2 環境変数を削除して v2 鍵を取れなくする
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v2
    vi.resetModules()
    const { decryptSecret } = await import('@/lib/two-factor')

    expect(() => decryptSecret(encryptedV2)).toThrow(
      /TWO_FACTOR_ENCRYPTION_KEY for v2 is not configured/,
    )
  })
})

describe('migrateToCurrentKeyVersion', () => {
  it('プレフィックスなし旧形式 → 現行 v2 への移行で再暗号化する', async () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY_v1 = KEY_V1
    process.env.TWO_FACTOR_KEY_VERSION = 'v1'
    let mod = await import('@/lib/two-factor')
    const encryptedV1 = mod.encryptSecret('SECRET')
    const legacyFormat = encryptedV1.replace(/^v1:/, '')

    process.env.TWO_FACTOR_ENCRYPTION_KEY_v2 = KEY_V2
    process.env.TWO_FACTOR_KEY_VERSION = 'v2'
    vi.resetModules()
    mod = await import('@/lib/two-factor')

    const migrated = mod.migrateToCurrentKeyVersion(legacyFormat)
    expect(migrated).not.toBeNull()
    expect(migrated).toMatch(/^v2:/)
    expect(mod.decryptSecret(migrated as string)).toBe('SECRET')
  })

  it('明示的 v1 → 現行 v1 (デフォルト) は何もしない (null 返却)', async () => {
    const { encryptSecret, migrateToCurrentKeyVersion } = await import('@/lib/two-factor')
    const encrypted = encryptSecret('SECRET')
    expect(encrypted).toMatch(/^v1:/)

    expect(migrateToCurrentKeyVersion(encrypted)).toBeNull()
  })
})

describe('verifyBackupCode (timing-safe 比較)', () => {
  it('長さが一致しないハッシュは無視する', async () => {
    const { verifyBackupCode, hashBackupCode } = await import('@/lib/two-factor')
    const validHash = hashBackupCode('ABCD1234')
    const shortHash = 'abc' // 不正な長さ

    // 長さ不一致は timingSafeEqual 前で skip される
    expect(verifyBackupCode('ABCD1234', [shortHash])).toBe(-1)
    // 長さが一致するものは検出される（正しい位置に）
    expect(verifyBackupCode('ABCD1234', [shortHash, validHash])).toBe(1)
  })

  it('hashedCodes に空文字列が混じっていてもクラッシュせず -1 / 正位置を返す', async () => {
    const { verifyBackupCode, hashBackupCode } = await import('@/lib/two-factor')
    const validHash = hashBackupCode('ZZZZ9999')
    expect(verifyBackupCode('AAAA1111', ['', validHash])).toBe(-1)
    expect(verifyBackupCode('ZZZZ9999', ['', validHash])).toBe(1)
  })

  it('複数一致候補があっても最初に見つかったインデックスを返す', async () => {
    const { verifyBackupCode, hashBackupCode } = await import('@/lib/two-factor')
    const h = hashBackupCode('SAMECODE')
    expect(verifyBackupCode('SAMECODE', [h, h, h])).toBe(0)
  })
})

describe('verifyTOTP (catch path)', () => {
  it('内部で例外が発生しても false を返し、伝播させない', async () => {
    // otp.verify が throw する状況を構築するのは難しいので、
    // ここでは長さチェック後の verify 経路が想定外の状態でも安全に false を返すことを確認する。
    // - 不正な base32 secret を渡しても crash しない
    const { verifyTOTP } = await import('@/lib/two-factor')
    const result = await verifyTOTP('123456', '!!INVALID-BASE32!!')
    expect(typeof result).toBe('boolean')
    expect(result).toBe(false)
  })
})
