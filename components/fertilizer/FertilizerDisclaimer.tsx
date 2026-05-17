import { Alert, AlertDescription } from '@/components/ui/alert'

export function FertilizerDisclaimer() {
  return (
    <Alert className="border-border bg-muted/50">
      <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
        施肥の情報は一般的な盆栽管理の知識に基づいた目安です。実際の施肥は樹の状態、用土、気候、環境に応じて調整してください。特定の肥料製品を推奨するものではありません。
      </AlertDescription>
    </Alert>
  )
}
