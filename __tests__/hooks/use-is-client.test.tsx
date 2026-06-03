/**
 * useIsClient: SSR/hydration mismatch を防ぐ client-only flag hook のテスト。
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsClient } from '@/hooks/use-is-client'

describe('useIsClient', () => {
  it('client (DOM) 環境では true を返す', () => {
    const { result } = renderHook(() => useIsClient())
    expect(result.current).toBe(true)
  })

  it('複数 component で同時に呼んでも独立して動作する', () => {
    const { result: a } = renderHook(() => useIsClient())
    const { result: b } = renderHook(() => useIsClient())
    expect(a.current).toBe(true)
    expect(b.current).toBe(true)
  })
})
