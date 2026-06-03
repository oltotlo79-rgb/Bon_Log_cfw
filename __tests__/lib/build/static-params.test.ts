// @vitest-environment node
/**
 * loadStaticParams のテスト
 *
 * 既存の static-params テスト群は loadStaticParams をモックしているため
 * このファイルでは関数本体のブランチ (skip / loader実行) を検証する。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockShouldSkip = vi.fn()
vi.mock('@/lib/build/db-availability', () => ({
  shouldSkipBuildTimeDbAccess: () => mockShouldSkip(),
}))

const mockWarn = vi.fn()
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { warn: mockWarn, log: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadStaticParams', () => {
  it('shouldSkipBuildTimeDbAccess=true のときは loader を呼ばず空配列を返す', async () => {
    mockShouldSkip.mockReturnValue(true)
    const loader = vi.fn().mockResolvedValue([{ slug: 'a' }])

    const { loadStaticParams } = await import('@/lib/build/static-params')
    const result = await loadStaticParams(loader, 'test-page')

    expect(result).toEqual([])
    expect(loader).not.toHaveBeenCalled()
    expect(mockWarn).toHaveBeenCalledWith(
      'Skipping generateStaticParams (DB unavailable)',
      { context: 'test-page' },
    )
  })

  it('shouldSkipBuildTimeDbAccess=false なら loader 結果をそのまま返す', async () => {
    mockShouldSkip.mockReturnValue(false)
    const loader = vi.fn().mockResolvedValue([{ slug: 'foo' }, { slug: 'bar' }])

    const { loadStaticParams } = await import('@/lib/build/static-params')
    const result = await loadStaticParams(loader)

    expect(result).toEqual([{ slug: 'foo' }, { slug: 'bar' }])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('loader が throw したら build を止めるため例外を伝播する', async () => {
    mockShouldSkip.mockReturnValue(false)
    const loader = vi.fn().mockRejectedValue(new Error('DB connection failed'))

    const { loadStaticParams } = await import('@/lib/build/static-params')

    await expect(loadStaticParams(loader, 'failing-page')).rejects.toThrow(
      'DB connection failed',
    )
  })

  it('context を省略しても skip 経路で warn が呼ばれる', async () => {
    mockShouldSkip.mockReturnValue(true)
    const loader = vi.fn()

    const { loadStaticParams } = await import('@/lib/build/static-params')
    const result = await loadStaticParams(loader)

    expect(result).toEqual([])
    expect(mockWarn).toHaveBeenCalledWith(
      'Skipping generateStaticParams (DB unavailable)',
      { context: undefined },
    )
  })
})

describe('isStaticParamsBuildSkippable (deprecated alias)', () => {
  it('shouldSkipBuildTimeDbAccess と同じ関数参照', async () => {
    const { isStaticParamsBuildSkippable } = await import('@/lib/build/static-params')
    const { shouldSkipBuildTimeDbAccess } = await import('@/lib/build/db-availability')
    expect(isStaticParamsBuildSkippable).toBe(shouldSkipBuildTimeDbAccess)
  })
})
