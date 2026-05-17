/**
 * @file 管理者メンテナンスモード設定ページ
 * @description メンテナンスモードの設定を管理するページ。
 *              現在のステータス（通常運用/メンテナンス中）を表示し、
 *              MaintenanceFormコンポーネントで設定を変更できる。
 */

// メンテナンス設定取得のServer Action
import { getMaintenanceSettings } from '@/lib/actions/maintenance'
// メンテナンス設定フォームコンポーネント
import { MaintenanceForm } from './MaintenanceForm'

import type { Metadata } from 'next'

/**
 * 静的メタデータ。
 *
 * 管理画面は外部公開を意図しないため index/follow を拒否する。
 */
export const metadata: Metadata = {
  title: 'メンテナンスモード設定',
  description: 'メンテナンスモードのオン・オフと開始/終了予定を設定する管理者ページ。',
  robots: { index: false, follow: false },
}

/**
 * 動的レンダリングを強制
 * メンテナンス設定は頻繁に変更される可能性があるため、
 * 常に最新の状態を取得するためにビルド時の静的生成を無効化
 */
export const dynamic = 'force-dynamic'

/**
 * 管理者メンテナンスモード設定ページコンポーネント
 * メンテナンス設定の表示と編集を提供する
 *
 * @returns メンテナンス設定ページのJSX要素
 *
 * 処理内容:
 * 1. getMaintenanceSettingsでメンテナンス設定を取得
 * 2. 現在のステータスを視覚的に表示（アニメーション付きインジケーター）
 * 3. MaintenanceFormで設定を編集
 * 4. 注意事項を表示（アクセス制限の詳細）
 */
export default async function MaintenancePage() {
  const settings = await getMaintenanceSettings()

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">メンテナンスモード</h1>
        <p className="text-muted-foreground">
          サービスを一時的に停止し、メンテナンス画面を表示します
        </p>
      </div>

      {/* 現在のステータス */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className={`w-4 h-4 rounded-full ${
              settings.enabled ? 'bg-muted animate-pulse' : 'bg-foreground'
            }`}
          />
          <div>
            <p className="font-medium">
              現在のステータス:{' '}
              <span className={settings.enabled ? 'text-destructive' : 'text-foreground'}>
                {settings.enabled ? 'メンテナンス中' : '通常運用'}
              </span>
            </p>
            {settings.enabled && settings.endTime && (
              <p className="text-sm text-muted-foreground">
                終了予定: {new Date(settings.endTime).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        </div>

        {/* 設定フォーム */}
        <MaintenanceForm settings={settings} />
      </div>

      {/* 注意事項 */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <h3 className="font-medium text-muted-foreground mb-2">注意事項</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>メンテナンス中は一般ユーザーがログインできなくなります</li>
          <li>管理者アカウントは通常通りアクセスできます</li>
          <li>以下のページはメンテナンス中もアクセス可能です：
            <ul className="ml-4 mt-1">
              <li>- トップページ（/）</li>
              <li>- ログインページ（/login）</li>
              <li>- 新規登録ページ（/register）</li>
              <li>- パスワードリセット（/password-reset）</li>
            </ul>
          </li>
          <li>終了時間を設定すると自動的にメンテナンスが終了します</li>
        </ul>
      </div>
    </div>
  )
}
