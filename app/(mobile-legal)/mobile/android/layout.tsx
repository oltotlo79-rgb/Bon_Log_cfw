import Link from 'next/link'
import {
  ROUTE_MOBILE_ANDROID_TERMS,
  ROUTE_MOBILE_ANDROID_PRIVACY,
  ROUTE_MOBILE_ANDROID_HELP,
} from '@/lib/constants/routes'

/**
 * @module app/(mobile-legal)/mobile/android/layout
 * Android 専用 public ページ（利用規約 / プライバシーポリシー / ヘルプ）専用の
 * 最小レイアウト。Google Play の課金ポリシー対応のため、既存サイトの
 * PublicSiteHeader / LegalLayout フッター（料金ページ・お問い合わせ等への
 * リンクを含む）を継承しない。相互リンクはこの 3 ページ間のみに限定する。
 */
export default function MobileAndroidLegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <span className="font-semibold text-lg text-primary">BON-LOG</span>
        </div>
      </header>

      <main id="main-content" className="max-w-2xl mx-auto px-4 py-8" tabIndex={-1}>
        {children}
      </main>

      <footer className="border-t bg-card mt-8">
        <nav
          aria-label="Android向けページ"
          className="max-w-2xl mx-auto px-4 py-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
        >
          <Link href={ROUTE_MOBILE_ANDROID_TERMS} className="underline hover:text-foreground">
            利用規約
          </Link>
          <Link href={ROUTE_MOBILE_ANDROID_PRIVACY} className="underline hover:text-foreground">
            プライバシーポリシー
          </Link>
          <Link href={ROUTE_MOBILE_ANDROID_HELP} className="underline hover:text-foreground">
            ヘルプ
          </Link>
        </nav>
      </footer>
    </div>
  )
}
