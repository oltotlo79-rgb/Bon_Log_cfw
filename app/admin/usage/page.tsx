import { Gauge } from 'lucide-react'
import { UsageCards } from './UsageCards'

export const metadata = {
  title: 'サービス使用量 - BON-LOG 管理',
}

export default function AdminUsagePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="w-6 h-6" />
        <div>
          <h1 className="text-2xl font-bold">サービス使用量</h1>
          <p className="text-sm text-muted-foreground">
            各クラウドサービスの使用状況を一括確認できます
          </p>
        </div>
      </div>

      <UsageCards />
    </div>
  )
}
