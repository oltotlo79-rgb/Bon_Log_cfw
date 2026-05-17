import { Alert, AlertDescription } from '@/components/ui/alert'

export function HormoneDisclaimer() {
  return (
    <Alert className="border-border bg-muted/50">
      <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
        本ページの植物ホルモン情報は植物生理学の一般的な知識に基づく教育目的の内容です。実際の盆栽管理では個々の樹種や環境条件に応じた判断が必要です。
      </AlertDescription>
    </Alert>
  )
}
