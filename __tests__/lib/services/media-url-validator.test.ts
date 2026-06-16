// @vitest-environment node
/**
 * lib/services/media-url-validator と lib/storage/allowed-origins のユニットテスト
 *
 * assertMediaUrlsFromOwnStorage の全分岐と、各 STORAGE_PROVIDER における
 * getAllowedStorageOrigins の挙動を検証する。
 */
import { vi, describe, it, expect, afterEach } from 'vitest'

describe('getAllowedStorageOrigins', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('STORAGE_PROVIDER=local のとき /uploads/ を返す', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'local')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    expect(getAllowedStorageOrigins()).toEqual(['/uploads/'])
  })

  it('STORAGE_PROVIDER 未設定（デフォルト）のとき /uploads/ を返す', async () => {
    vi.stubEnv('STORAGE_PROVIDER', '')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    const result = getAllowedStorageOrigins()
    expect(result).toEqual(['/uploads/'])
  })

  it('STORAGE_PROVIDER=r2 かつ R2_PUBLIC_URL 設定時: カスタムドメインを含む', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', 'https://cdn.example.com')
    vi.stubEnv('R2_ACCOUNT_ID', '')
    vi.stubEnv('R2_BUCKET_NAME', '')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    const result = getAllowedStorageOrigins()
    expect(result).toContain('https://cdn.example.com/')
  })

  it('STORAGE_PROVIDER=r2 かつ R2_PUBLIC_URL がスラッシュ末尾の場合: 重複しない', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', 'https://cdn.example.com/')
    vi.stubEnv('R2_ACCOUNT_ID', '')
    vi.stubEnv('R2_BUCKET_NAME', '')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    const result = getAllowedStorageOrigins()
    expect(result).toContain('https://cdn.example.com/')
  })

  it('STORAGE_PROVIDER=r2 かつ R2_ACCOUNT_ID 設定時: r2.dev 形式を含む', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', '')
    vi.stubEnv('R2_ACCOUNT_ID', 'acc123')
    vi.stubEnv('R2_BUCKET_NAME', 'my-bucket')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    const result = getAllowedStorageOrigins()
    expect(result).toContain('https://my-bucket.acc123.r2.dev/')
  })

  it('STORAGE_PROVIDER=r2 かつ R2_PUBLIC_URL も R2_ACCOUNT_ID も未設定: 空配列', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', '')
    vi.stubEnv('R2_ACCOUNT_ID', '')
    vi.stubEnv('R2_BUCKET_NAME', '')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    const result = getAllowedStorageOrigins()
    expect(result).toHaveLength(0)
  })

  it('STORAGE_PROVIDER=supabase かつ NEXT_PUBLIC_SUPABASE_URL 設定時: storage path を含む', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'supabase')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('SUPABASE_STORAGE_BUCKET', 'media')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    const result = getAllowedStorageOrigins()
    expect(result).toEqual(['https://abc.supabase.co/storage/v1/object/public/media/'])
  })

  it('STORAGE_PROVIDER=supabase かつ NEXT_PUBLIC_SUPABASE_URL 未設定: 空配列', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'supabase')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const { getAllowedStorageOrigins } = await import('@/lib/storage/allowed-origins')
    const result = getAllowedStorageOrigins()
    expect(result).toHaveLength(0)
  })
})

describe('assertMediaUrlsFromOwnStorage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('空配列は常に true', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'local')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    expect(assertMediaUrlsFromOwnStorage([])).toBe(true)
  })

  it('local: /uploads/ で始まる URL は通る', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'local')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    expect(assertMediaUrlsFromOwnStorage(['/uploads/posts/img.webp'])).toBe(true)
  })

  it('local: 外部 URL は弾かれる', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'local')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    expect(assertMediaUrlsFromOwnStorage(['https://evil.example.com/tracker.gif'])).toBe(false)
  })

  it('local: 複数 URL のうち 1 件でも外部 URL があると false', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'local')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    expect(
      assertMediaUrlsFromOwnStorage([
        '/uploads/posts/ok.webp',
        'https://evil.example.com/bad.gif',
      ]),
    ).toBe(false)
  })

  it('r2: R2_PUBLIC_URL 設定時の自社 URL は通る', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', 'https://cdn.example.com')
    vi.stubEnv('R2_ACCOUNT_ID', '')
    vi.stubEnv('R2_BUCKET_NAME', '')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    expect(assertMediaUrlsFromOwnStorage(['https://cdn.example.com/posts/img.webp'])).toBe(true)
  })

  it('r2: 外部 URL は弾かれる', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', 'https://cdn.example.com')
    vi.stubEnv('R2_ACCOUNT_ID', '')
    vi.stubEnv('R2_BUCKET_NAME', '')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    expect(assertMediaUrlsFromOwnStorage(['https://evil.example.com/spy.gif'])).toBe(false)
  })

  it('許可プレフィックスが 0 件（env 未設定）の場合はスキップして true', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', '')
    vi.stubEnv('R2_ACCOUNT_ID', '')
    vi.stubEnv('R2_BUCKET_NAME', '')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    // origin 0 件 → 検証スキップ → true
    expect(assertMediaUrlsFromOwnStorage(['https://anywhere.example.com/img.webp'])).toBe(true)
  })

  it('複数の有効 URL がすべて自社ドメインなら true', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2')
    vi.stubEnv('R2_PUBLIC_URL', 'https://cdn.example.com')
    vi.stubEnv('R2_ACCOUNT_ID', 'acc123')
    vi.stubEnv('R2_BUCKET_NAME', 'uploads')
    const { assertMediaUrlsFromOwnStorage } = await import('@/lib/services/media-url-validator')
    expect(
      assertMediaUrlsFromOwnStorage([
        'https://cdn.example.com/posts/a.webp',
        'https://uploads.acc123.r2.dev/posts/b.mp4',
      ]),
    ).toBe(true)
  })
})
