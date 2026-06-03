/**
 * @file CookieConsent の実ロジック検証テスト
 *
 * vitest.setup.tsx が window.localStorage を vi.fn() だけのモックに置き換えているため、
 * このテスト内では各メソッドを「Map ベースの挙動」に差し替えて永続性を再現する。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import {
  CookieConsent,
  getCookieConsent,
  isTrackingAllowed,
} from '@/components/common/CookieConsent'

const STORAGE_KEY = 'cookie-consent'

/**
 * vitest.setup.tsx の vi.fn() モックに「実際に値を保持する挙動」を注入する。
 * 返り値のマップを空にすれば localStorage.clear() と同等。
 */
function installLocalStorageMap(): Map<string, string> {
  const store = new Map<string, string>()
  const ls = window.localStorage
  ;(ls.getItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) =>
    store.has(k) ? store.get(k) ?? null : null,
  )
  ;(ls.setItem as ReturnType<typeof vi.fn>).mockImplementation((k: string, v: string) => {
    store.set(k, v)
  })
  ;(ls.removeItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) => {
    store.delete(k)
  })
  ;(ls.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
    store.clear()
  })
  return store
}

describe('getCookieConsent', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installLocalStorageMap()
  })

  it('未設定のときは null', () => {
    expect(getCookieConsent()).toBeNull()
  })

  it('"all" が保存されていればそのまま返す', () => {
    store.set(STORAGE_KEY, 'all')
    expect(getCookieConsent()).toBe('all')
  })

  it('"essential" が保存されていればそのまま返す', () => {
    store.set(STORAGE_KEY, 'essential')
    expect(getCookieConsent()).toBe('essential')
  })

  it('想定外の値が保存されている場合は null に正規化する', () => {
    store.set(STORAGE_KEY, 'garbage')
    expect(getCookieConsent()).toBeNull()
  })
})

describe('isTrackingAllowed', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installLocalStorageMap()
  })

  it('同意なしの場合は false', () => {
    expect(isTrackingAllowed()).toBe(false)
  })

  it('essential のみの場合は false（tracking は許可されない）', () => {
    store.set(STORAGE_KEY, 'essential')
    expect(isTrackingAllowed()).toBe(false)
  })

  it('all 同意時のみ true', () => {
    store.set(STORAGE_KEY, 'all')
    expect(isTrackingAllowed()).toBe(true)
  })
})

describe('CookieConsent UI', () => {
  let store: Map<string, string>
  const originalLocation = window.location
  const reloadMock = vi.fn()

  beforeEach(() => {
    store = installLocalStorageMap()
    reloadMock.mockReset()
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  it('同意未保存時にバナーを表示する', () => {
    render(<CookieConsent />)
    expect(screen.getByRole('dialog', { name: 'Cookie利用の同意' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'すべて同意' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '必要最小限のみ' })).toBeInTheDocument()
  })

  it('既に同意済み (all) の場合はバナーをレンダリングしない', () => {
    store.set(STORAGE_KEY, 'all')
    const { container } = render(<CookieConsent />)
    expect(container.firstChild).toBeNull()
  })

  it('既に同意済み (essential) の場合もバナーをレンダリングしない', () => {
    store.set(STORAGE_KEY, 'essential')
    const { container } = render(<CookieConsent />)
    expect(container.firstChild).toBeNull()
  })

  it('「すべて同意」で localStorage=all に保存しバナーを閉じる（reload は呼ばない）', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'すべて同意' }))
    expect(store.get(STORAGE_KEY)).toBe('all')
    // VisitorBeacon / AdProvider が CustomEvent を購読して自動的に
    // 広告スクリプト読み込みと beacon 送信を行うため、フルリロードは不要。
    expect(reloadMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('「すべて同意」で cookie-consent-change CustomEvent が dispatch される', () => {
    const listener = vi.fn()
    window.addEventListener('cookie-consent-change', listener)
    try {
      render(<CookieConsent />)
      fireEvent.click(screen.getByRole('button', { name: 'すべて同意' }))
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('cookie-consent-change', listener)
    }
  })

  it('「必要最小限のみ」で localStorage=essential に保存しバナーを閉じる（reload しない）', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: '必要最小限のみ' }))
    expect(store.get(STORAGE_KEY)).toBe('essential')
    expect(reloadMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('プライバシーポリシーへのリンクを持つ', () => {
    render(<CookieConsent />)
    const link = screen.getByRole('link', { name: 'プライバシーポリシー' })
    expect(link).toHaveAttribute('href', '/privacy')
  })
})
