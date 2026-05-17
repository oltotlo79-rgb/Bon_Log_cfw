/**
 * useFocusTrap のユニットテスト。
 * - 初回マウント時に最初の focusable 要素にフォーカスする
 * - Tab で末尾→先頭にループ
 * - Shift+Tab で先頭→末尾にループ
 * - active=false ではトラップしない
 * - アンマウント時に元の要素にフォーカス復帰
 * - hidden / aria-hidden / disabled な要素は対象外
 */

import { renderHook } from '@testing-library/react'
import { useRef } from 'react'

import { useFocusTrap } from '@/hooks/use-focus-trap'

function setupContainer(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

function dispatchTab(shift = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift }))
}

describe('useFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('active=true で最初の focusable 要素にフォーカスする', () => {
    const root = setupContainer(`
      <button id="b1">1</button>
      <button id="b2">2</button>
      <button id="b3">3</button>
    `)

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(null)
      ref.current = root
      useFocusTrap(ref, true)
      return null
    })

    expect(document.activeElement?.id).toBe('b1')
  })

  it('Tab で末尾要素から先頭にループする', () => {
    const root = setupContainer(`
      <button id="b1">1</button>
      <button id="b2">2</button>
      <button id="b3">3</button>
    `)

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(null)
      ref.current = root
      useFocusTrap(ref, true)
      return null
    })

    // 末尾にフォーカスを移して Tab → 先頭に戻る
    const last = document.getElementById('b3') as HTMLButtonElement
    last.focus()
    dispatchTab(false)
    expect(document.activeElement?.id).toBe('b1')
  })

  it('Shift+Tab で先頭要素から末尾にループする', () => {
    const root = setupContainer(`
      <button id="b1">1</button>
      <button id="b2">2</button>
      <button id="b3">3</button>
    `)

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(null)
      ref.current = root
      useFocusTrap(ref, true)
      return null
    })

    const first = document.getElementById('b1') as HTMLButtonElement
    first.focus()
    dispatchTab(true)
    expect(document.activeElement?.id).toBe('b3')
  })

  it('active=false のときはフォーカスを移動しない', () => {
    const root = setupContainer(`
      <button id="b1">1</button>
      <button id="outside">outside</button>
    `)
    const outside = document.getElementById('outside') as HTMLButtonElement
    outside.focus()

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(null)
      ref.current = root
      useFocusTrap(ref, false)
      return null
    })

    expect(document.activeElement?.id).toBe('outside')
  })

  it('disabled / hidden の要素は対象外', () => {
    const root = setupContainer(`
      <button id="b1" disabled>disabled</button>
      <button id="b2" hidden>hidden</button>
      <button id="b3">visible</button>
    `)

    renderHook(() => {
      const ref = useRef<HTMLElement | null>(null)
      ref.current = root
      useFocusTrap(ref, true)
      return null
    })

    // 最初の有効な要素は b3
    expect(document.activeElement?.id).toBe('b3')
  })

  it('アンマウント時に元の要素へフォーカスを復帰する', () => {
    const trigger = document.createElement('button')
    trigger.id = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()

    const root = setupContainer(`<button id="b1">1</button>`)

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(null)
      ref.current = root
      useFocusTrap(ref, true)
      return null
    })

    expect(document.activeElement?.id).toBe('b1')
    unmount()
    expect(document.activeElement?.id).toBe('trigger')
  })
})
