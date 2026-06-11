/**
 * HomeUrlCleaner の回帰テスト。
 *
 * 「ログアウト → /login → トップへ戻る」で着地する `/?from=auth` から、一過性の
 * 遷移マーカーを履歴から除去し URL を `/` に戻すこと、再ナビゲーションを起こさないことを保証する。
 *
 * @see components/landing/HomeUrlCleaner.tsx
 * @see app/(auth)/layout.tsx
 */

import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HomeUrlCleaner } from '@/components/landing/HomeUrlCleaner'

function setLocation(href: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  })
}

describe('HomeUrlCleaner', () => {
  let replaceState: (data: unknown, unused: string, url?: string | URL | null) => void

  beforeEach(() => {
    replaceState = vi.fn() as unknown as (data: unknown, unused: string, url?: string | URL | null) => void
    vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('?from=auth を履歴から除去して URL を / に戻す', () => {
    setLocation('http://localhost:3000/?from=auth')
    render(<HomeUrlCleaner />)
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('他のクエリは保持し from のみ除去する', () => {
    setLocation('http://localhost:3000/?from=auth&ref=x')
    render(<HomeUrlCleaner />)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?ref=x')
  })

  it('from が無ければ何もしない (再ナビゲーション・履歴操作を発生させない)', () => {
    setLocation('http://localhost:3000/')
    render(<HomeUrlCleaner />)
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('何も描画しない', () => {
    setLocation('http://localhost:3000/')
    const { container } = render(<HomeUrlCleaner />)
    expect(container).toBeEmptyDOMElement()
  })
})
