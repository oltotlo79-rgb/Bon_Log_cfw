/**
 * メンテナンスページ
 * メンテナンス中に一般ユーザーに表示されるページ
 */

import { getMaintenanceSettings } from '@/lib/actions/maintenance'
import { auth } from '@/lib/auth'
import { MaintenanceLogoutButton } from './logout-button'
import type { Metadata } from 'next'

/**
 * 静的メタデータ。
 *
 * メンテナンスページは恒常的に公開される URL ではない。検索エンジンが
 * 一時的なメンテナンス状態をキャッシュ・index しないよう robots を制御する。
 */
export const metadata: Metadata = {
  title: 'メンテナンス中',
  description: 'ただいまサービスをメンテナンス中です。しばらくしてから再度アクセスしてください。',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * 工具アイコン
 */
function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

/**
 * 日時をフォーマット
 */
function formatDateTime(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function MaintenancePage() {
  const session = await auth()
  const isLoggedIn = !!session?.user
  const settings = await getMaintenanceSettings()

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <WrenchIcon className="w-10 h-10 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          メンテナンス中
        </h1>

        <p className="text-gray-600 mb-6 whitespace-pre-wrap">
          {settings.message || 'ただいまメンテナンス中です。しばらくお待ちください。'}
        </p>

        {(settings.startTime || settings.endTime) && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-600">
            <p className="font-medium text-gray-800 mb-2">メンテナンス期間</p>
            {settings.startTime && (
              <p>開始: {formatDateTime(settings.startTime)}</p>
            )}
            {settings.endTime && (
              <p>終了予定: {formatDateTime(settings.endTime)}</p>
            )}
          </div>
        )}

        {isLoggedIn && (
          <div className="mb-6">
            <MaintenanceLogoutButton />
          </div>
        )}

        <div className="mt-8 pt-6 border-t">
          {/*
            意図的に `next/link` ではなく素の `<a>` を使う。
            Why: proxy.ts は `/` をログイン状態に応じて `/feed` にリダイレクトする。
            Router Cache がログイン中の `/` → `/feed` redirect を保持していると、
            ログアウト後でも `/feed` に飛ばされる事象が発生する。full-page nav で回避する。
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="text-foreground font-bold text-xl">
            BON-LOG
          </a>
          <p className="text-xs text-gray-400 mt-1">
            盆栽愛好家のためのSNS
          </p>
        </div>
      </div>
    </div>
  )
}
