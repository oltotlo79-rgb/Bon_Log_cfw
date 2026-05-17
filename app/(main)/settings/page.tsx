/**
 * @fileoverview 設定トップページ
 *
 * 各設定カテゴリ（プロフィール、アカウント、プラン管理）へのナビゲーションメニューと
 * テーマ・背景アニメーション・天気アドバイスの設定を提供する Server Component。
 *
 * ゲストユーザー（GUEST_EMAIL）はテーマ・背景アニメーションのみ変更可能。
 * その他のメニューと天気アドバイスは「表示はするが選択不可」の状態で描画する。
 *
 * @route /settings
 */

import Link from 'next/link'
import {
  Bell as BellIcon,
  ChevronRight as ChevronRightIcon,
  User as UserIcon,
  Settings as SettingsIcon,
  Crown as CrownIcon,
  Shield as ShieldIcon,
  Ban as BanIcon,
  VolumeX as VolumeOffIcon,
  Users as UsersIcon,
  CloudSun as CloudSunIcon,
  type LucideIcon,
} from 'lucide-react'

import { auth } from '@/lib/auth'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { cn } from '@/lib/utils'
import { ThemeSelect } from '@/components/theme/ThemeToggle'
import { BgAnimationSelect } from '@/components/settings/SakuraPetalsToggle'
import { WeatherLocationSetting } from '@/components/weather/WeatherLocationSetting'

export const metadata = {
  title: '設定 - BON-LOG',
}

type SettingsMenuItem = {
  href: string
  icon: LucideIcon
  title: string
  description: string
}

/**
 * 設定トップに並ぶメニュー項目（順序維持のため `as const`）。
 * ハードコードされたリテラルを描画ロジックから分離する。
 */
const SETTINGS_MENU_ITEMS: readonly SettingsMenuItem[] = [
  {
    href: '/settings/profile',
    icon: UserIcon,
    title: 'プロフィール編集',
    description: 'ニックネーム、自己紹介、プロフィール画像などを編集',
  },
  {
    href: '/settings/notifications',
    icon: BellIcon,
    title: '通知設定',
    description: '通知の種類ごとにON/OFFを設定',
  },
  {
    href: '/settings/account',
    icon: SettingsIcon,
    title: 'アカウント設定',
    description: '公開設定、アカウント削除など',
  },
  {
    href: '/settings/security',
    icon: ShieldIcon,
    title: 'セキュリティ設定',
    description: '2段階認証、パスワード管理など',
  },
  {
    href: '/settings/follow-requests',
    icon: UsersIcon,
    title: 'フォローリクエスト',
    description: '受信したフォローリクエストの確認・承認',
  },
  {
    href: '/settings/blocked',
    icon: BanIcon,
    title: 'ブロック中のユーザー',
    description: 'ブロック中のユーザー一覧とブロック解除',
  },
  {
    href: '/settings/muted',
    icon: VolumeOffIcon,
    title: 'ミュート中のユーザー',
    description: 'ミュート中のユーザー一覧とミュート解除',
  },
  {
    href: '/settings/subscription',
    icon: CrownIcon,
    title: 'プラン管理',
    description: 'プレミアム会員への登録、支払い履歴の確認',
  },
] as const

/** ゲスト向けに非インタラクティブ表示する際の共通 className。 */
const DISABLED_CARD_CLASSES = 'opacity-50 select-none'
/** ゲスト向けメニュー項目の共通 className（ホバー反応・カーソルを抑止）。 */
const DISABLED_ITEM_CLASSES = 'flex items-center gap-4 p-4 opacity-50 cursor-not-allowed select-none'
/** 認証ユーザー向けメニュー項目の共通 className。 */
const ENABLED_ITEM_CLASSES = 'flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors'

/** 天気アドバイス案内文（ゲストは登録後の利用を想起させるため常時提示）。 */
const WEATHER_ADVICE_DESCRIPTION =
  '位置情報を登録すると、天気に基づく盆栽管理アドバイスがタイムラインに表示されます'

/**
 * 設定トップページ。
 *
 * Server Component として `auth()` で現在のセッションを取得し、
 * ゲスト判定の結果に応じて編集系メニュー・天気設定の操作可否を切り替える。
 */
export default async function SettingsPage() {
  const session = await auth()
  const isGuest = session?.user?.email === GUEST_EMAIL

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {isGuest && (
        <p className="text-sm text-muted-foreground">
          ゲストは表示設定のみ変更できます。プロフィールやアカウント設定などは新規登録後にご利用いただけます。
        </p>
      )}

      {/* メニュー（ゲストは表示するが選択不可） */}
      <div className="bg-card rounded-lg border">
        <h1 className="px-4 py-3 font-bold text-lg border-b">設定</h1>
        <div className="divide-y">
          {SETTINGS_MENU_ITEMS.map((item) => (
            <SettingsMenuRow key={item.href} item={item} disabled={isGuest} />
          ))}
        </div>
      </div>

      {/* 表示設定（ゲストも操作可能） */}
      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">表示設定</h2>
        <div className="p-4 space-y-6">
          <ThemeSelect />
          <BgAnimationSelect />
        </div>
      </div>

      {/* 天気アドバイス（ゲストは表示するが操作不可・データフェッチもスキップ） */}
      <div
        data-testid="weather-advice-section"
        data-disabled={isGuest || undefined}
        className={cn('bg-card rounded-lg border', isGuest && DISABLED_CARD_CLASSES)}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <CloudSunIcon className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold">天気アドバイス</h2>
        </div>
        <div className="p-4">
          {isGuest ? (
            <p className="text-sm text-muted-foreground">{WEATHER_ADVICE_DESCRIPTION}</p>
          ) : (
            <WeatherLocationSetting />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 設定メニュー1行分。`disabled=true` の場合はナビゲーション不可の `<div>` として描画する。
 *
 * Why: `<Link>` を残したまま `pointer-events-none` で抑止するとブラウザ拡張・JS 無効環境で
 * 抜け道になりうるため、ゲストでは非リンク要素として描画して経路自体を断つ。
 */
function SettingsMenuRow({
  item,
  disabled,
}: {
  item: SettingsMenuItem
  disabled: boolean
}) {
  const Icon = item.icon
  const content = (
    <>
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{item.title}</p>
        <p className="text-sm text-muted-foreground">{item.description}</p>
      </div>
      <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
    </>
  )

  if (disabled) {
    return (
      <div className={DISABLED_ITEM_CLASSES} aria-disabled="true" role="link">
        {content}
      </div>
    )
  }

  return (
    <Link href={item.href} className={ENABLED_ITEM_CLASSES}>
      {content}
    </Link>
  )
}
