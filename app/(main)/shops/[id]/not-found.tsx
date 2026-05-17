import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ShopNotFound() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">盆栽園が見つかりません</h1>
        <p className="text-muted-foreground mb-6">
          この盆栽園は削除されたか、存在しない可能性があります。
        </p>
        <Button asChild>
          <Link href="/shops">盆栽園マップに戻る</Link>
        </Button>
      </div>
    </div>
  )
}
