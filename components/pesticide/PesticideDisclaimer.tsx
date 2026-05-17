import { Alert, AlertDescription } from '@/components/ui/alert'

export function PesticideDisclaimer() {
  return (
    <Alert className="border-border bg-muted/50">
      <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
        本機能の農薬・病害虫情報は参考用です。実際の使用にあたっては、必ず農薬のラベルおよび最新の登録情報を確認し、用法・用量・使用時期を守ってください。登録情報は随時変更されることがあります。
      </AlertDescription>
    </Alert>
  )
}
