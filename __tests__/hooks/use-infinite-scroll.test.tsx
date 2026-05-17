import { renderHook } from '@testing-library/react'

// 末尾センチネルが見えているか否かをテストから制御できるようにモック化
const inViewRef = { current: false }
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: () => {},
    inView: inViewRef.current,
  }),
}))

import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    inViewRef.current = false
  })

  it('does not call fetchNextPage when the sentinel is off-screen', () => {
    const fetchNextPage = vi.fn()
    renderHook(() =>
      useInfiniteScroll({ hasNextPage: true, isFetchingNextPage: false, fetchNextPage }),
    )
    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it('calls fetchNextPage when sentinel is in view and next page exists', () => {
    inViewRef.current = true
    const fetchNextPage = vi.fn()
    renderHook(() =>
      useInfiniteScroll({ hasNextPage: true, isFetchingNextPage: false, fetchNextPage }),
    )
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('does not call fetchNextPage while fetching', () => {
    inViewRef.current = true
    const fetchNextPage = vi.fn()
    renderHook(() =>
      useInfiniteScroll({ hasNextPage: true, isFetchingNextPage: true, fetchNextPage }),
    )
    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it('does not call fetchNextPage when there is no next page', () => {
    inViewRef.current = true
    const fetchNextPage = vi.fn()
    renderHook(() =>
      useInfiniteScroll({ hasNextPage: false, isFetchingNextPage: false, fetchNextPage }),
    )
    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it('skips when enabled=false even if sentinel is visible', () => {
    inViewRef.current = true
    const fetchNextPage = vi.fn()
    renderHook(() =>
      useInfiniteScroll({
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage,
        enabled: false,
      }),
    )
    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it('handles undefined hasNextPage (falsy)', () => {
    inViewRef.current = true
    const fetchNextPage = vi.fn()
    renderHook(() =>
      useInfiniteScroll({
        hasNextPage: undefined,
        isFetchingNextPage: false,
        fetchNextPage,
      }),
    )
    expect(fetchNextPage).not.toHaveBeenCalled()
  })
})
