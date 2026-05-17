/**
 * 設定ページでゲストユーザー向けに表示する案内
 *
 * プロフィール編集・アカウント設定など、新規登録後に利用できる機能に
 * ゲストがURL直アクセスした場合に表示する。
 */

import Link from 'next/link'
import { ERR_GUEST_CANNOT_CREATE } from '@/lib/constants/errors'
import { ROUTE_SETTINGS, ROUTE_REGISTER } from '@/lib/constants/routes'

type SettingsGuestRestrictionProps = {
  /** ページタイトル（例: プロフィール編集、アカウント設定） */
  title: string
  /** 案内文（省略時は ERR_GUEST_CANNOT_CREATE） */
  message?: string
}

export function SettingsGuestRestriction({ title, message = ERR_GUEST_CANNOT_CREATE }: SettingsGuestRestrictionProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={ROUTE_SETTINGS} className="text-sm text-muted-foreground hover:underline">
            &larr; 設定に戻る
          </Link>
          <h1 className="font-bold text-lg mt-1">{title}</h1>
        </div>
        <div className="p-6">
          <p className="text-muted-foreground mb-4">{message}</p>
          <Link
            href={ROUTE_REGISTER}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            新規登録する
          </Link>
        </div>
      </div>
    </div>
  )
}
