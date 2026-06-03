/**
 * AuthLayout の回帰テスト。
 *
 * Why: 「ログアウト → /login → トップへ戻る」で意図せず /feed → /onboarding に飛ばされる事象を再発防止する。
 * AuthLayout の "トップへ戻る" は (1) full-page navigation (`<a>` タグ) で Router Cache を回避し、
 * (2) ログイン中に訪問され得ないクエリ付き URL (`/?from=auth`) へ遷移して、CDN / bfcache に
 * 残った `/`→`/feed` 認証依存リダイレクトの再生を構造的に防ぐ。
 *
 * @see app/(auth)/layout.tsx
 * @see components/landing/HomeUrlCleaner.tsx
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AuthLayout from '@/app/(auth)/layout'
import { ROUTE_HOME_FROM_AUTH } from '@/lib/constants/routes'

describe('AuthLayout', () => {
  it('"トップへ戻る" は素の <a href="/?from=auth"> を使う (Router Cache 回避 + キャッシュ済み認証リダイレクトの再生防止)', () => {
    render(
      <AuthLayout>
        <div>auth content</div>
      </AuthLayout>,
    )

    const backLink = screen.getByText('トップへ戻る').closest('a')
    expect(backLink).not.toBeNull()
    // クエリ付き home URL: ログイン中に踏まれ得ないため `/`→`/feed` のキャッシュ済み 307 が存在しない。
    expect(backLink?.getAttribute('href')).toBe(ROUTE_HOME_FROM_AUTH)
    // 素の `/` ではキャッシュ済みリダイレクト再生のリスクが残るため不可。
    expect(backLink?.getAttribute('href')).not.toBe('/')
    // Next.js Link は <a> をレンダリングするが追加で `data-prefetch` 等を付与する。
    // ここでは「Link 経由ではないこと」を data-attribute の欠落で保証する。
    expect(backLink?.hasAttribute('data-prefetch')).toBe(false)
  })

  it('child content をレンダリングする', () => {
    render(
      <AuthLayout>
        <div data-testid="auth-child">auth child</div>
      </AuthLayout>,
    )
    expect(screen.getByTestId('auth-child')).toBeInTheDocument()
  })
})
