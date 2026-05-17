import Link from 'next/link'
import { PublicSiteHeader } from '@/components/common/PublicSiteHeader'
import {
  ROUTE_ABOUT,
  ROUTE_ACCESSIBILITY,
  ROUTE_CONTACT,
  ROUTE_HELP,
  ROUTE_PRIVACY,
  ROUTE_TERMS,
} from '@/lib/constants/routes'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <PublicSiteHeader />

      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8" tabIndex={-1}>
        {children}
      </main>

      <footer className="border-t bg-card mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-4">
            <Link href={ROUTE_ABOUT} className="hover:text-foreground">BON-LOGについて</Link>
            <Link href={ROUTE_TERMS} className="hover:text-foreground">利用規約</Link>
            <Link href={ROUTE_PRIVACY} className="hover:text-foreground">プライバシーポリシー</Link>
            <Link href={ROUTE_HELP} className="hover:text-foreground">ヘルプ</Link>
            <Link href={ROUTE_CONTACT} className="hover:text-foreground">お問い合わせ</Link>
            <Link href={ROUTE_ACCESSIBILITY} className="hover:text-foreground">アクセシビリティ</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            &copy; 2024 BON-LOG. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
