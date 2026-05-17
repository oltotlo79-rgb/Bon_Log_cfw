/**
 * ルート 404 ページ
 *
 * 存在しないURLや notFound() 呼び出し時に表示されます。
 * 投稿専用の not-found は (main)/posts/[id]/not-found.tsx で上書き可能です。
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTE_HOME, ROUTE_FEED } from '@/lib/constants/routes'

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-card rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">ページが見つかりません</h1>
        <p className="text-muted-foreground mb-6">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href={ROUTE_HOME}>トップへ</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTE_FEED}>タイムラインへ</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
