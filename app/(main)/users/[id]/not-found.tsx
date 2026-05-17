import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function UserNotFound() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">ユーザーが見つかりません</h1>
        <p className="text-muted-foreground mb-6">
          このユーザーは削除されたか、存在しない可能性があります。
        </p>
        <Button asChild>
          <Link href="/feed">タイムラインに戻る</Link>
        </Button>
      </div>
    </div>
  )
}
