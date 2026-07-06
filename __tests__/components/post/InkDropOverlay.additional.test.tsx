import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '../../utils/test-utils'
import { InkDropOverlay } from '@/components/post/InkDropOverlay'
import { INK_DROP_DURATION, INK_CLEAR_DURATION } from '@/lib/constants/limits/ui'

describe('InkDropOverlay - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('INK_DROP_DURATION 経過後 clearing フェーズに切り替わる', () => {
    const { container } = render(<InkDropOverlay active={true} />)

    act(() => {
      vi.advanceTimersByTime(INK_DROP_DURATION)
    })

    const overlay = container.querySelector('.fixed > div')
    expect(overlay?.className).toContain('opacity-0')
    expect(overlay?.className).toContain('[clip-path:circle(0%_at_50%_100%)]')
  })

  it('INK_CLEAR_DURATION 経過後 idle フェーズに戻り何も表示しない', () => {
    const { container } = render(<InkDropOverlay active={true} />)

    act(() => {
      vi.advanceTimersByTime(INK_CLEAR_DURATION)
    })

    expect(container.innerHTML).toBe('')
  })

  it('active が true から false に戻ると次回 true になった時に再度 dropping から始まる', () => {
    const { container, rerender } = render(<InkDropOverlay active={true} />)

    act(() => {
      vi.advanceTimersByTime(INK_CLEAR_DURATION)
    })
    expect(container.innerHTML).toBe('')

    // active=false を経由してから再度 true にする (prevActive のリセットを踏む)
    rerender(<InkDropOverlay active={false} />)
    rerender(<InkDropOverlay active={true} />)

    act(() => {
      vi.advanceTimersByTime(0)
    })

    const overlay = container.querySelector('.fixed > div')
    expect(overlay?.className).toContain('opacity-80')
    expect(overlay?.className).toContain('[clip-path:circle(150%_at_50%_0%)]')
  })

  it('active=true のまま再レンダリングしても二重にタイマーを起動しない（prevActiveガード）', () => {
    const { container, rerender } = render(<InkDropOverlay active={true} />)
    rerender(<InkDropOverlay active={true} />)

    act(() => {
      vi.advanceTimersByTime(INK_DROP_DURATION)
    })

    const overlay = container.querySelector('.fixed > div')
    // 二重起動していれば dropping のままになるはずが、単一サイクル通り clearing に進む
    expect(overlay?.className).toContain('opacity-0')
  })
})
