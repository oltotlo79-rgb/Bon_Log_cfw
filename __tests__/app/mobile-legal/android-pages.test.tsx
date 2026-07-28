/**
 * app/(mobile-legal)/mobile/android/{terms,privacy,help}/page.tsx と layout.tsx のレンダーテスト
 *
 * Google Play 提出向けの Android 専用 public ページが、例外なく描画され、
 * ANDROID_LEGAL_DOCUMENTS の全 sections を漏れなく表示すること、
 * および Web 決済導線（/settings/subscription 等）や外部決済ドメインへの
 * anchor が一切含まれないことを検証する。
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ANDROID_LEGAL_DOCUMENTS } from '@/lib/constants/legal'
import {
  ROUTE_MOBILE_ANDROID_TERMS,
  ROUTE_MOBILE_ANDROID_PRIVACY,
  ROUTE_MOBILE_ANDROID_HELP,
  ROUTE_SETTINGS_SUBSCRIPTION,
} from '@/lib/constants/routes'

/** container 内の全 anchor href を収集する */
function collectHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
}

const FORBIDDEN_HREF_PATTERNS = [
  ROUTE_SETTINGS_SUBSCRIPTION,
  'stripe.com',
  '/checkout',
  'checkout.stripe.com',
]

describe('app/(mobile-legal)/mobile/android/terms/page', () => {
  it('例外なく描画され、terms の全 sections を表示する', async () => {
    const { default: Page } = await import('@/app/(mobile-legal)/mobile/android/terms/page')
    const { container } = render(<Page />)

    expect(screen.getByRole('heading', { level: 1, name: '利用規約' })).toBeInTheDocument()
    for (const section of ANDROID_LEGAL_DOCUMENTS.terms.sections) {
      expect(screen.getByText(section.heading)).toBeInTheDocument()
    }
    expect(collectHrefs(container).every((href) => !FORBIDDEN_HREF_PATTERNS.some((p) => href.includes(p)))).toBe(true)
  })

  it('generateMetadata 相当の metadata に canonical が含まれる', async () => {
    const mod = await import('@/app/(mobile-legal)/mobile/android/terms/page')
    expect(mod.metadata.alternates?.canonical).toContain(ROUTE_MOBILE_ANDROID_TERMS)
  })
})

describe('app/(mobile-legal)/mobile/android/privacy/page', () => {
  it('例外なく描画され、privacy の全 sections を表示する', async () => {
    const { default: Page } = await import('@/app/(mobile-legal)/mobile/android/privacy/page')
    const { container } = render(<Page />)

    expect(screen.getByRole('heading', { level: 1, name: 'プライバシーポリシー' })).toBeInTheDocument()
    for (const section of ANDROID_LEGAL_DOCUMENTS.privacy.sections) {
      expect(screen.getByText(section.heading)).toBeInTheDocument()
    }
    expect(collectHrefs(container).every((href) => !FORBIDDEN_HREF_PATTERNS.some((p) => href.includes(p)))).toBe(true)
  })

  it('generateMetadata 相当の metadata に canonical が含まれる', async () => {
    const mod = await import('@/app/(mobile-legal)/mobile/android/privacy/page')
    expect(mod.metadata.alternates?.canonical).toContain(ROUTE_MOBILE_ANDROID_PRIVACY)
  })
})

describe('app/(mobile-legal)/mobile/android/help/page', () => {
  it('例外なく描画され、FAQ グループ・質問文が表示される', async () => {
    const { default: Page } = await import('@/app/(mobile-legal)/mobile/android/help/page')
    const { container } = render(<Page />)

    expect(screen.getByRole('heading', { level: 1, name: 'ヘルプ' })).toBeInTheDocument()
    expect(screen.getByText('BON-LOGとは何ですか？')).toBeInTheDocument()
    expect(
      screen.getByText('プレミアム会員の購入・解約はどこから行いますか？'),
    ).toBeInTheDocument()
    expect(collectHrefs(container).every((href) => !FORBIDDEN_HREF_PATTERNS.some((p) => href.includes(p)))).toBe(true)
  })

  it('プレミアム会員 FAQ の回答が Google Play からの購入・解約のみを案内する（決済誘導なし）', async () => {
    const { default: Page } = await import('@/app/(mobile-legal)/mobile/android/help/page')
    render(<Page />)

    const answer = screen.getByText(/プレミアム会員の購入・変更・解約は、すべて Google Play/)
    expect(answer).toBeInTheDocument()
    expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument()
  })

  it('generateMetadata 相当の metadata に canonical が含まれる', async () => {
    const mod = await import('@/app/(mobile-legal)/mobile/android/help/page')
    expect(mod.metadata.alternates?.canonical).toContain(ROUTE_MOBILE_ANDROID_HELP)
  })
})

describe('app/(mobile-legal)/mobile/android/layout', () => {
  it('BON-LOG ヘッダーと 3 ページ間の相互リンクのみのフッターを描画する', async () => {
    const { default: Layout } = await import('@/app/(mobile-legal)/mobile/android/layout')
    const { container } = render(
      <Layout>
        <div data-testid="child-content">child</div>
      </Layout>,
    )

    expect(screen.getByText('BON-LOG')).toBeInTheDocument()
    expect(screen.getByTestId('child-content')).toBeInTheDocument()

    const hrefs = collectHrefs(container)
    expect(hrefs).toEqual(
      expect.arrayContaining([
        ROUTE_MOBILE_ANDROID_TERMS,
        ROUTE_MOBILE_ANDROID_PRIVACY,
        ROUTE_MOBILE_ANDROID_HELP,
      ]),
    )
    // Web ページ（/privacy, /terms, /settings/subscription 等）へのリンクを含まない
    for (const href of hrefs) {
      expect(FORBIDDEN_HREF_PATTERNS.some((p) => href.includes(p))).toBe(false)
    }
    expect(hrefs).toHaveLength(3)
  })
})
