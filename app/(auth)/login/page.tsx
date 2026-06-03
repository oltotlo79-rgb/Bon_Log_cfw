import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ROUTE_FEED, ROUTE_LOGIN } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'ログイン',
  description: 'BON-LOGにログインして、盆栽愛好家コミュニティに参加しましょう。',
  alternates: { canonical: pageCanonical(ROUTE_LOGIN) },
  // 認証フローページは検索インデックス対象外 (canonical は対称性のため保持)
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect(ROUTE_FEED)
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-serif text-3xl font-bold text-center text-card-foreground mb-10 tracking-widest">ログイン</h1>
      {/* LoginForm は useSearchParams (callbackUrl 取得) を使うため Suspense 境界が必須 */}
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}

function LoginFormFallback() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-10 bg-muted rounded" />
      <div className="h-10 bg-muted rounded" />
      <div className="h-10 bg-muted rounded" />
    </div>
  )
}
