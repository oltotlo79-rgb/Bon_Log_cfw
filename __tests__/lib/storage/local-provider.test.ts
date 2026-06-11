// @vitest-environment node
/**
 * LocalStorageProvider のテスト
 *
 * 主に path traversal ガード (uploadDir 配下から外れるパスへの delete 試行) を検証する。
 * 通常のアップロード/削除/拡張子分岐は storage/index.test.ts で網羅済み。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockMkdir = vi.fn()
const mockWriteFile = vi.fn()
const mockUnlink = vi.fn()

vi.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  ;(process.env as { NODE_ENV: string | undefined }).NODE_ENV = undefined
})

describe('LocalStorageProvider.delete: path traversal ガード', () => {
  it('"../" を含む URL を unlink せず error を返す', async () => {
    const { LocalStorageProvider } = await import('@/lib/storage/local-provider')
    const provider = new LocalStorageProvider()

    const result = await provider.delete('/uploads/../../../etc/passwd')

    expect(result.success).toBe(false)
    expect(mockUnlink).not.toHaveBeenCalled()
    expect(result.error).toMatch(/削除に失敗|traversal/)
  })

  it('uploadDir 配下の通常パスは unlink を呼ぶ', async () => {
    mockUnlink.mockResolvedValue(undefined)
    const { LocalStorageProvider } = await import('@/lib/storage/local-provider')
    const provider = new LocalStorageProvider()

    const result = await provider.delete('/uploads/avatars/legit-file.jpg')

    expect(result.success).toBe(true)
    expect(mockUnlink).toHaveBeenCalledTimes(1)
  })

  it('絶対パスエスケープ (/uploads が path.resolve で外に逃げる) も拒否する', async () => {
    const { LocalStorageProvider } = await import('@/lib/storage/local-provider')
    const provider = new LocalStorageProvider()

    // /uploads/ プレフィックスを除いた残りで sequence of '../' を含むケース
    const result = await provider.delete('/uploads/avatars/../../../escape.jpg')

    expect(result.success).toBe(false)
    expect(mockUnlink).not.toHaveBeenCalled()
  })
})

describe('LocalStorageProvider.upload', () => {
  it('アップロードに成功すると /uploads/{folder}/{unique}.{ext} を返す', async () => {
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)

    const { LocalStorageProvider } = await import('@/lib/storage/local-provider')
    const provider = new LocalStorageProvider()

    const result = await provider.upload(
      Buffer.from('hi'),
      'orig.jpg',
      'image/jpeg',
      'posts',
    )

    expect(result.success).toBe(true)
    expect(result.url).toMatch(/^\/uploads\/posts\/\d+-[a-f0-9]+\.jpg$/)
  })

  it('mkdir 失敗時は error を返す', async () => {
    mockMkdir.mockRejectedValueOnce(new Error('mkdir failed'))

    const { LocalStorageProvider } = await import('@/lib/storage/local-provider')
    const provider = new LocalStorageProvider()

    const result = await provider.upload(
      Buffer.from('x'),
      'f.jpg',
      'image/jpeg',
      'posts',
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
