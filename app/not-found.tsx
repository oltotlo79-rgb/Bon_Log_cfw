/**
 * ルート 404 ページ
 *
 * 存在しないURLや notFound() 呼び出し時に表示されます。
 * 投稿専用の not-found は (main)/posts/[id]/not-found.tsx で上書き可能です。
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTE_FEED } from '@/lib/constants/routes'

// Why 明示的 noindex: Next.js は 404 レスポンスを返すため自動的にインデックスされないが、
// 監査ツール (Lighthouse / SEO ツール) での「robots 未設定」検知を回避するため明示する。
export const metadata: Metadata = {
  title: 'ページが見つかりません',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-card rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">ページが見つかりません</h1>
        <p className="text-muted-foreground mb-6">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/*
            「トップへ」は意図的に `next/link` ではなく素の `<a>` を使う。
            Why: proxy.ts は `/` をログイン状態に応じて `/feed` にリダイレクトする。
            Next.js の Router Cache がログイン中の `/` → `/feed` redirect を保持していると、
            ログアウト後の遷移でも cached payload が再生され、`/` を踏んでも `/feed` に
            飛ばされる事象が発生する。full-page navigation なら Router Cache をバイパスし、
            proxy が最新の cookie 状態を評価できる。
          */}
          <Button asChild>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">トップへ</a>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTE_FEED}>タイムラインへ</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
