import Link from 'next/link'
import { ROUTE_REGISTER } from '@/lib/constants/routes'

type GuestRestrictionOverlayProps = {
  /** ゲストの場合はオーバーレイを表示 */
  isGuest: boolean
  children: React.ReactNode
  /** 表示するコンテンツ名（例: 盆栽マップ、イベント、病害虫） */
  contentName: string
}

/**
 * ゲストユーザー向けの制限オーバーレイ。
 * コンテンツにモザイク（ぼかし）をかけ、新規登録を促すメッセージを表示する。
 */
export function GuestRestrictionOverlay({
  isGuest,
  children,
  contentName,
}: GuestRestrictionOverlayProps) {
  if (!isGuest) return <>{children}</>

  return (
    <div className="relative min-h-[60vh]">
      {/* 背面: ぼかし＋モザイク風で中身を見せない（薄め） */}
      <div
        className="pointer-events-none select-none blur-md opacity-40"
        aria-hidden
      >
        {children}
      </div>
      {/* 前面: メッセージ（上寄せでスクロールせず見えるように） */}
      <div className="absolute inset-0 flex flex-col items-center justify-start gap-4 bg-background/50 backdrop-blur-sm p-6 pt-12 rounded-lg">
        <p className="text-center text-lg font-medium text-muted-foreground max-w-md">
          {contentName}は新規登録後にご利用いただけます。
        </p>
        <p className="text-center text-sm text-muted-foreground max-w-md">
          会員登録（無料）すると、盆栽園マップ・イベント・病害虫・農薬検索などすべての機能をご利用いただけます。
        </p>
        <Link
          href={ROUTE_REGISTER}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          無料で新規登録
        </Link>
      </div>
    </div>
  )
}
