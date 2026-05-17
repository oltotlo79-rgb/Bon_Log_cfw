/**
 * useFingerprint のユニットテスト。
 *
 * - マウント時に fingerprint を取得する
 * - アンマウント時にキャンセルし、後発の解決でステートを更新しない
 * - 取得失敗（null）時はステートが null のまま
 */

import { vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockGetFingerprint = vi.fn()
vi.mock('@/lib/fingerprint', () => ({
  getFingerprintWithCache: () => mockGetFingerprint(),
}))

import { useFingerprint } from '@/hooks/use-fingerprint'

describe('useFingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('マウント時に fingerprint を取得し state にセットする', async () => {
    mockGetFingerprint.mockResolvedValueOnce('fp-abc-123')
    const { result } = renderHook(() => useFingerprint())

    expect(result.current).toBe(null)
    await waitFor(() => expect(result.current).toBe('fp-abc-123'))
    expect(mockGetFingerprint).toHaveBeenCalledTimes(1)
  })

  it('取得結果が null の場合は state は null のまま', async () => {
    mockGetFingerprint.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useFingerprint())

    await waitFor(() => expect(mockGetFingerprint).toHaveBeenCalled())
    expect(result.current).toBe(null)
  })

  it('アンマウント後に解決しても state は更新しない（メモリリーク回避）', async () => {
    let resolveFn: ((v: string | null) => void) | undefined
    mockGetFingerprint.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          resolveFn = resolve
        }),
    )
    const { result, unmount } = renderHook(() => useFingerprint())
    expect(result.current).toBe(null)
    unmount()
    // ここで解決しても setState は呼ばれない（cancelled で抑止される）
    resolveFn?.('late-fp')
    // result はアンマウント後の最終値で固定（null）
    expect(result.current).toBe(null)
  })
})
