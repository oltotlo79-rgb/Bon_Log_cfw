import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTE_ADMIN_CONTACT } from '@/lib/constants/routes'

export default function AdminContactNotFound() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">お問い合わせが見つかりません</h1>
        <p className="text-muted-foreground mb-6">
          指定されたお問い合わせは削除されたか、存在しません。
        </p>
        <Button asChild>
          <Link href={ROUTE_ADMIN_CONTACT}>お問い合わせ一覧に戻る</Link>
        </Button>
      </div>
    </div>
  )
}
