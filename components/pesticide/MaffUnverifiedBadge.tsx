import { AlertTriangle } from 'lucide-react'

type MaffUnverifiedBadgeProps = {
  show: boolean
}

/**
 * registrationNumber が null の農薬製品に表示する注意バッジ。
 * null はサイト DB に登録番号が未掲載であることを示すのみで、
 * MAFF 側での登録状態は不明なため、断定的な表現は使わない。
 * null チェックを callee ではなく caller（ページ）が判断して show を渡すことで
 * 将来 isVerified フラグ追加時の差し替えをページ側のみで完結できる。
 */
export function MaffUnverifiedBadge({ show }: MaffUnverifiedBadgeProps) {
  if (!show) return null

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
      <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        <span className="font-medium">登録番号は未掲載です</span>
        {'　'}
        <span>
          この製品の農薬登録番号は当サイトで確認できていません。ご使用前に{' '}
          <a
            href="https://pesticide.maff.go.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            農林水産省の農薬登録情報提供システム
          </a>
          で最新の登録情報をご確認ください。
        </span>
      </div>
    </div>
  )
}
