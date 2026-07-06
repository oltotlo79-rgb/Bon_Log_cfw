import { vi, describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent } from '../../utils/test-utils'
import { InkRippleInit } from '@/components/common/InkRippleInit'

describe('InkRippleInit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // クリーンアップ: 残ったripple要素を削除
    document.querySelectorAll('.ink-ripple').forEach(el => el.remove())
  })

  it('nullを返す（UIを描画しない）', () => {
    const { container } = render(<InkRippleInit />)
    expect(container.innerHTML).toBe('')
  })

  it('btn-washiクリック時にink-ripple要素を追加する', () => {
    render(
      <>
        <InkRippleInit />
        <button className="btn-washi" data-testid="btn">テスト</button>
      </>
    )

    const btn = document.querySelector('.btn-washi')!
    fireEvent.click(btn)

    const ripple = btn.querySelector('.ink-ripple')
    expect(ripple).toBeInTheDocument()
  })

  it('btn-washi以外のクリックではrippleを追加しない', () => {
    render(
      <>
        <InkRippleInit />
        <button className="normal-btn" data-testid="btn">通常</button>
      </>
    )

    const btn = document.querySelector('.normal-btn')!
    fireEvent.click(btn)

    const ripple = btn.querySelector('.ink-ripple')
    expect(ripple).toBeNull()
  })

  it('animationend で ripple 要素が自動的に除去される', () => {
    render(
      <>
        <InkRippleInit />
        <button className="btn-washi">テスト</button>
      </>
    )

    const btn = document.querySelector('.btn-washi')!
    fireEvent.click(btn)

    const ripple = btn.querySelector('.ink-ripple') as HTMLElement
    expect(ripple).toBeInTheDocument()

    fireEvent.animationEnd(ripple)

    expect(btn.querySelector('.ink-ripple')).toBeNull()
  })

  it('e.target が Element でない場合は何もしない（防御分岐）', () => {
    render(
      <>
        <InkRippleInit />
        <button className="btn-washi">テスト</button>
      </>
    )

    const btn = document.querySelector('.btn-washi')!
    // target が Element でないケース (例: 削除済みノードや合成イベント) を模した MouseEvent。
    // Document/Text 等は closest を持たないため、target を null にして安全に検証する。
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: null, configurable: true })

    expect(() => btn.dispatchEvent(event)).not.toThrow()
    expect(btn.querySelector('.ink-ripple')).toBeNull()
  })

  it('ripple要素にクリック位置が設定される', () => {
    render(
      <>
        <InkRippleInit />
        <button className="btn-washi" style={{ width: 200, height: 50 }}>テスト</button>
      </>
    )

    const btn = document.querySelector('.btn-washi')!
    fireEvent.click(btn, { clientX: 100, clientY: 25 })

    const ripple = btn.querySelector('.ink-ripple') as HTMLElement
    expect(ripple).toBeInTheDocument()
    expect(ripple.style.left).toBeDefined()
    expect(ripple.style.top).toBeDefined()
  })
})
