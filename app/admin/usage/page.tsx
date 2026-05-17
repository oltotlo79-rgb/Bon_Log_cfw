/**
 * @file 管理者用サービス使用量ページ
 * @description 各クラウドサービス（Vercel、Supabase、Cloudflare R2、Resend）の
 *              使用状況を一括確認できる管理者ページ。
 */

// サービス使用量カードコンポーネント
import { UsageCards } from './UsageCards'

/**
 * ページメタデータの定義
 * ブラウザのタイトルバーに表示される
 */
export const metadata = {
  title: 'サービス使用量 - BON-LOG 管理',
}

/**
 * ゲージ/メーターアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 14 4-4"/>
      <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
    </svg>
  )
}

/**
 * 管理者用サービス使用量ページコンポーネント
 * 各クラウドサービスの使用状況を表示する
 *
 * @returns サービス使用量ページのJSX要素
 *
 * 処理内容:
 * 1. ページヘッダー（タイトル・説明）を表示
 * 2. UsageCardsコンポーネントで各サービスの使用量を表示
 */
export default function AdminUsagePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GaugeIcon className="w-6 h-6" />
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
