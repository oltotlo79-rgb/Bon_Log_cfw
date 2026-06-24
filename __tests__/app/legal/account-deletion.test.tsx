/**
 * アカウント削除ページ（/account-deletion）の回帰テスト。
 *
 * Google Play デベロッパーポリシー準拠のため、このページが以下の条件を
 * 常に満たしていることを保証する:
 * - 必須文言（アプリ名・提供者・連絡先・削除手順・データ説明）の存在
 * - 静的 metadata が正しい title / canonical を持つ
 * - PROTECTED_PATHS に含まれない（公開性）
 * - sitemap に /account-deletion が登録されている
 * - robots.ts の Disallow に /account-deletion が含まれない
 * - legal layout のフッターリンクに「アカウント削除」が存在する
 */

// @vitest-environment jsdom

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ================================================================
// 共通モック
// ================================================================

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test stub
    <img src={src} alt={alt} />
  ),
}))

// PublicSiteHeader は useSession を呼ぶ Client Component のためモックする
vi.mock('@/components/common/PublicSiteHeader', () => ({
  PublicSiteHeader: () => <header data-testid="public-site-header" />,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'unauthenticated', data: null }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// sitemap 用 DB モック
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    post: { findMany: vi.fn().mockResolvedValue([]) },
    bonsaiShop: { findMany: vi.fn().mockResolvedValue([]) },
    event: { findMany: vi.fn().mockResolvedValue([]) },
    bonsaiTerm: { findMany: vi.fn().mockResolvedValue([]) },
    pesticide: { findMany: vi.fn().mockResolvedValue([]) },
    diseasePest: { findMany: vi.fn().mockResolvedValue([]) },
    bonsai: { findMany: vi.fn().mockResolvedValue([]) },
    pesticideColumn: { findMany: vi.fn().mockResolvedValue([]) },
    activeIngredient: { findMany: vi.fn().mockResolvedValue([]) },
    spreaderType: { findMany: vi.fn().mockResolvedValue([]) },
    fertilizerColumn: { findMany: vi.fn().mockResolvedValue([]) },
    fertilizerNutrient: { findMany: vi.fn().mockResolvedValue([]) },
    treeSpecies: { findMany: vi.fn().mockResolvedValue([]) },
    hormoneType: { findMany: vi.fn().mockResolvedValue([]) },
    hormoneColumn: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/build/db-availability', () => ({
  shouldSkipBuildTimeDbAccess: () => false,
}))

// ================================================================
// 1. 必須文言・コンテンツ検証
// ================================================================
describe('AccountDeletionPage – コンテンツ', async () => {
  const { default: Page } = await import('@/app/(legal)/account-deletion/page')
  const { SUPPORT_EMAIL, OPERATOR_NAME } = await import('@/lib/constants/contact')

  it('アプリ名 BON-LOG / ボンログ が表示される', () => {
    render(Page())
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/BON-LOG|ボンログ/)
  })

  it('提供者名「野村侑矢」が表示される', () => {
    render(Page())
    expect(document.body.textContent).toContain('野村侑矢')
  })

  it('連絡先メール bon.log2026@gmail.com が表示される', () => {
    render(Page())
    expect(document.body.textContent).toContain(SUPPORT_EMAIL)
  })

  it('「アカウントを削除」の手順ステップが存在する', () => {
    render(Page())
    expect(document.body.textContent).toContain('アカウントを削除')
  })

  it('「削除されるデータ」見出しが存在する', () => {
    render(Page())
    expect(screen.getByRole('heading', { name: '削除されるデータ' })).toBeInTheDocument()
  })

  it('「保持されるデータ」見出しが存在する', () => {
    render(Page())
    expect(screen.getByRole('heading', { name: '保持されるデータ' })).toBeInTheDocument()
  })

  it('即時確定の旨（「即時」または「ただちに」）が記載されている', () => {
    render(Page())
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/即時|ただちに/)
  })

  it('復元不可の旨（「復元」）が記載されている', () => {
    render(Page())
    const text = document.body.textContent ?? ''
    expect(text).toContain('復元')
  })

  it('メールアドレスのリンクが mailto: 形式で存在する', () => {
    render(Page())
    const mailtoLinks = document.querySelectorAll(`a[href="mailto:${SUPPORT_EMAIL}"]`)
    expect(mailtoLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('h1 見出しが「アカウント削除のご案内」である', () => {
    render(Page())
    expect(screen.getByRole('heading', { level: 1, name: 'アカウント削除のご案内' })).toBeInTheDocument()
  })

  it('OPERATOR_NAME 定数が野村侑矢を含む', () => {
    expect(OPERATOR_NAME).toContain('野村侑矢')
  })

  it('SUPPORT_EMAIL 定数が bon.log2026@gmail.com である', () => {
    expect(SUPPORT_EMAIL).toBe('bon.log2026@gmail.com')
  })
})

// ================================================================
// 2. metadata 検証
// ================================================================
describe('AccountDeletionPage – metadata', () => {
  it('title が「アカウント削除のご案内」である', async () => {
    const mod = await import('@/app/(legal)/account-deletion/page')
    expect(mod.metadata?.title).toBe('アカウント削除のご案内')
  })

  it('canonical が ROUTE_ACCOUNT_DELETION 由来の絶対 URL である', async () => {
    const mod = await import('@/app/(legal)/account-deletion/page')
    const { ROUTE_ACCOUNT_DELETION, BASE_URL } = await import('@/lib/constants/routes')
    const canonical = mod.metadata?.alternates?.canonical as string | undefined
    expect(canonical).toBeDefined()
    expect(canonical).toContain(ROUTE_ACCOUNT_DELETION)
    expect(canonical).toMatch(/^https?:\/\//)
    expect(canonical).toContain(BASE_URL)
  })

  it('description が存在し空でない', async () => {
    const mod = await import('@/app/(legal)/account-deletion/page')
    expect(mod.metadata?.description).toBeTruthy()
    expect(String(mod.metadata?.description).length).toBeGreaterThan(20)
  })
})

// ================================================================
// 3. 公開性（PROTECTED_PATHS に含まれないこと）
// ================================================================
describe('ROUTE_ACCOUNT_DELETION – 公開性', () => {
  it('ROUTE_ACCOUNT_DELETION が /account-deletion である', async () => {
    const { ROUTE_ACCOUNT_DELETION } = await import('@/lib/constants/routes')
    expect(ROUTE_ACCOUNT_DELETION).toBe('/account-deletion')
  })

  it('PROTECTED_PATHS に /account-deletion が含まれない（公開ページ保証）', async () => {
    const { PROTECTED_PATHS, ROUTE_ACCOUNT_DELETION } = await import('@/lib/constants/routes')
    const paths = PROTECTED_PATHS as readonly string[]
    expect(paths).not.toContain(ROUTE_ACCOUNT_DELETION)
    // prefix 一致もないことを確認
    for (const p of paths) {
      expect(
        ROUTE_ACCOUNT_DELETION.startsWith(p),
        `ROUTE_ACCOUNT_DELETION (${ROUTE_ACCOUNT_DELETION}) が protected prefix ${p} に一致してしまう`,
      ).toBe(false)
    }
  })
})

// ================================================================
// 4. sitemap 登録
// ================================================================
describe('sitemap – /account-deletion 登録', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sitemap の出力に /account-deletion を含む URL エントリが存在する', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    const matched = urls.some((url) => {
      try {
        return new URL(url).pathname === '/account-deletion'
      } catch {
        return false
      }
    })
    expect(matched).toBe(true)
  })

  it('sitemap の /account-deletion エントリに lastModified / priority が設定されている', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = await sitemap()
    const entry = entries.find((e) => {
      try {
        return new URL(e.url).pathname === '/account-deletion'
      } catch {
        return false
      }
    })
    expect(entry).toBeDefined()
    expect(entry?.lastModified).toBeDefined()
    expect(entry?.priority).toBeDefined()
  })
})

// ================================================================
// 5. robots – Disallow リストに含まれないこと
// ================================================================
describe('robots – /account-deletion は Disallow されない', () => {
  it('robots の全ルールの Disallow に /account-deletion が含まれない', async () => {
    const { default: robots } = await import('@/app/robots')
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : []
      for (const d of disallow) {
        // 完全一致のブロック
        expect(d).not.toBe('/account-deletion')
        // /account-deletion がプレフィックスにマッチしないことを確認
        // ("/", "/*" などの全体ブロックは除外して検査)
        if (typeof d === 'string' && d !== '/' && d !== '/*') {
          const prefix = d.replace(/\*$/, '')
          const isBlocked = '/account-deletion'.startsWith(prefix)
          expect(
            isBlocked,
            `robots Disallow "${d}" が /account-deletion をブロックしてしまう`,
          ).toBe(false)
        }
      }
    }
  })
})

// ================================================================
// 6. legal layout フッターリンク
// ================================================================
describe('LegalLayout – フッターリンク', async () => {
  const { default: LegalLayout } = await import('@/app/(legal)/layout')

  it('フッターに「アカウント削除」リンク（href=/account-deletion）が存在する', () => {
    render(LegalLayout({ children: <div>content</div> }))
    const link = screen.getByRole('link', { name: 'アカウント削除' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/account-deletion')
  })

  it('legal layout は children をレンダリングする', () => {
    render(LegalLayout({ children: <div data-testid="legal-child">content</div> }))
    expect(screen.getByTestId('legal-child')).toBeInTheDocument()
  })
})
