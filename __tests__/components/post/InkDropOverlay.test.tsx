import { vi, describe, it, expect, afterEach } from 'vitest'
import { render, act } from '../../utils/test-utils'
import { InkDropOverlay } from '@/components/post/InkDropOverlay'

describe('InkDropOverlay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('active=falseの場合は何も表示しない', () => {
    const { container } = render(<InkDropOverlay active={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('active=trueの場合にオーバーレイを表示する', async () => {
    const { container } = render(<InkDropOverlay active={true} />)

    // setTimeout(fn, 0)でdropping phaseに移行するのを待つ
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const overlay = container.querySelector('.fixed')
    expect(overlay).toBeInTheDocument()
  })

  it('オーバーレイはpointer-events-noneクラスを持つ', async () => {
    const { container } = render(<InkDropOverlay active={true} />)

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const overlay = container.querySelector('.pointer-events-none')
    expect(overlay).toBeInTheDocument()
  })

  it('z-[100]で最前面に表示される', async () => {
    const { container } = render(<InkDropOverlay active={true} />)

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const overlay = container.querySelector('[class*="z-"]')
    expect(overlay).toBeInTheDocument()
  })
})
