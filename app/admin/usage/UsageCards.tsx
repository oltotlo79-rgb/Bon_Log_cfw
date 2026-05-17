/**
 * @file サービス使用量カードコンポーネント
 * @description 各クラウドサービスの使用状況をカード形式で表示するクライアントコンポーネント。
 *              API経由でリアルタイムの使用量を取得し、プログレスバーで視覚化する。
 */

'use client'

// ReactのuseStateとuseEffectフック（状態管理と副作用用）
import { useState, useEffect } from 'react'
// サービス使用量の型定義
import type { ServiceUsage } from '@/lib/services/usage'
import { USAGE_DANGER_THRESHOLD, USAGE_WARNING_THRESHOLD } from '@/lib/constants/limits'

/**
 * 更新/リフレッシュアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  )
}

/**
 * 外部リンクアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  )
}

/**
 * チェック/成功アイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

/**
 * 警告/アラートアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" x2="12" y1="9" y2="13"/>
      <line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
  )
}

/**
 * エラー/Xアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <path d="m15 9-6 6"/>
      <path d="m9 9 6 6"/>
    </svg>
  )
}

/**
 * 設定/歯車アイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

/**
 * 各サービスのロゴアイコン定義
 * サービス名をキーとしてSVGアイコンを格納
 */
const serviceIcons: Record<string, React.ReactNode> = {
  Vercel: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M24 22.525H0l12-21.05 12 21.05z"/>
    </svg>
  ),
  Supabase: (
    <svg viewBox="0 0 109 113" className="w-6 h-6" fill="none">
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347z" fill="url(#a)"/>
      <path d="M63.708 110.284c-2.86 3.601-8.658 1.628-8.727-2.97l-1.007-67.251h45.22c8.19 0 12.758 9.46 7.665 15.874l-43.151 54.347z" fill="url(#b)" fillOpacity=".2"/>
      <path d="M45.317 2.071c2.86-3.601 8.657-1.628 8.726 2.97l.442 67.251H9.83c-8.19 0-12.759-9.46-7.665-15.875L45.317 2.072z" fill="#3ECF8E"/>
      <defs>
        <linearGradient id="a" x1="53.974" y1="54.974" x2="94.163" y2="71.829" gradientUnits="userSpaceOnUse">
          <stop stopColor="#249361"/>
          <stop offset="1" stopColor="#3ECF8E"/>
        </linearGradient>
        <linearGradient id="b" x1="36.156" y1="30.578" x2="54.484" y2="65.081" gradientUnits="userSpaceOnUse">
          <stop/>
          <stop offset="1" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  'Cloudflare R2': (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#F38020">
      <path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.2678-.2246-.2795-.5765-.4242-1.0197-.4454l-8.6727-.0726c-.0537 0-.0966-.0215-.1182-.0537a.1435.1435 0 0 1-.021-.1475c.0322-.0752.0966-.129.1767-.1366l8.7453-.0753c.9814-.0322 2.0412-.8125 2.3959-1.7618l.449-1.1997c.0216-.0537.0322-.1143.021-.1689-.4017-1.9526-2.1423-3.411-4.2195-3.411-1.9082 0-3.5318 1.2476-4.0917 2.9682-.389-.2903-.8716-.4242-1.4032-.3628-1.0037.1099-1.8105.9383-1.9312 1.9421-.0322.2687-.0161.5374.0429.7845-1.649.0752-2.9682 1.4315-2.9682 3.1091 0 .1689.0107.3378.0322.5068.0108.0752.0752.1289.1475.1289h12.814c.075 0 .1398-.0645.1582-.1398z"/>
    </svg>
  ),
  Resend: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm3.519 0L12 11.671 18.481 6H5.52zM20 7.329l-8 7-8-7V18h16V7.329z"/>
    </svg>
  ),
}

/**
 * 各サービスのブランドカラー定義
 * サービス名をキーとしてTailwind CSSクラスを格納
 */
const serviceColors: Record<string, string> = {
  Vercel: 'bg-black text-white',
  Supabase: 'bg-emerald-600 text-white',
  'Cloudflare R2': 'bg-orange-500 text-white',
  Resend: 'bg-black text-white',
}

/**
 * 個別サービス使用量カードコンポーネント
 * 1つのサービスの使用状況を表示するカード
 *
 * @param service - サービス使用量データ
 * @returns サービスカードのJSX要素
 *
 * 表示内容:
 * - サービス名とロゴ
 * - ステータス（正常/警告/エラー/未設定）
 * - 使用量プログレスバー
 * - ダッシュボードへのリンク
 * - エラーメッセージ・ヘルプテキスト
 */
function UsageCard({ service }: { service: ServiceUsage }) {
  const statusIcon = {
    ok: <CheckCircleIcon className="w-5 h-5 text-foreground" />,
    warning: <AlertTriangleIcon className="w-5 h-5 text-muted-foreground" />,
    error: <XCircleIcon className="w-5 h-5 text-destructive" />,
    unconfigured: <SettingsIcon className="w-5 h-5 text-muted-foreground" />,
  }

  const statusLabel = {
    ok: '正常',
    warning: '警告',
    error: 'エラー',
    unconfigured: '未設定',
  }

  return (
    <div className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${serviceColors[service.name] || 'bg-gray-500 text-white'}`}>
            {serviceIcons[service.name] || (
              <div className="w-6 h-6 flex items-center justify-center text-sm font-bold">
                {service.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold">{service.name}</h3>
            <div className="flex items-center gap-1 text-sm">
              {statusIcon[service.status]}
              <span className={
                service.status === 'ok' ? 'text-foreground' :
                service.status === 'warning' ? 'text-muted-foreground' :
                service.status === 'error' ? 'text-destructive' :
                'text-muted-foreground'
              }>
                {statusLabel[service.status]}
              </span>
            </div>
          </div>
        </div>

        <a
          href={service.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="ダッシュボードを開く"
        >
          <ExternalLinkIcon className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>

      {/* エラーメッセージ */}
      {service.error && (
        <div className="mb-3 p-2 bg-muted/50 rounded text-sm text-destructive">
          {service.error}
        </div>
      )}

      {/* ヘルプテキスト（未設定時） */}
      {service.status === 'unconfigured' && service.helpText && (
        <div className="mb-3">
          <p className="text-sm text-muted-foreground mb-2">{service.helpText}</p>
          {service.helpUrl && (
            <a
              href={service.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              トークンを作成
              <ExternalLinkIcon className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* 使用量表示 */}
      {service.usage && service.usage.length > 0 && (
        <div className="space-y-3">
          {service.usage.map((item, index) => {
            const current = item.current ?? 0
            const limit = item.limit ?? 0
            const percentage = item.percentage ?? 0
            return (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{item.unit ?? '不明'}</span>
                  <span className="font-medium">
                    {limit > 0
                      ? `${current.toLocaleString()} / ${limit.toLocaleString()}`
                      : current.toLocaleString()
                    }
                  </span>
                </div>
                {limit > 0 && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        percentage >= USAGE_DANGER_THRESHOLD
                          ? 'bg-foreground'
                          : percentage >= USAGE_WARNING_THRESHOLD
                          ? 'bg-muted-foreground'
                          : 'bg-foreground'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Vercel特別表示：API未取得項目の案内 */}
      {service.name === 'Vercel' && service.status === 'ok' && (
        <div className="mt-3 p-2 bg-muted/50 border border-border rounded text-xs">
          <p className="text-muted-foreground mb-1">
            「—」の項目はAPIで取得できないため、ダッシュボードで確認してください
          </p>
          <a
            href={service.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:underline font-medium"
          >
            Vercel Usage ダッシュボード
            <ExternalLinkIcon className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* ヘルプテキスト（正常時・Vercel以外） */}
      {service.status === 'ok' && service.helpText && service.name !== 'Vercel' && (
        <p className="text-xs text-muted-foreground mt-3">{service.helpText}</p>
      )}

      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
        更新: {new Date(service.lastUpdated).toLocaleString('ja-JP')}
      </p>
    </div>
  )
}

/**
 * サービス使用量カード一覧コンポーネント
 * 全サービスの使用量カードを表示し、データ取得・更新機能を提供する
 *
 * @returns サービス使用量カード一覧のJSX要素
 *
 * 機能:
 * - 初回マウント時に使用量データを取得
 * - 手動更新ボタン
 * - ローディング状態のスケルトン表示
 * - エラー表示
 * - 未設定サービスの環境変数設定ガイド
 */
export function UsageCards() {
  const [services, setServices] = useState<ServiceUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchUsage = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/usage')
      if (!response.ok) {
        throw new Error('使用量の取得に失敗しました')
      }

      const data = await response.json()
      setServices(data.data)
      setLastFetched(new Date(data.fetchedAt))
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  if (loading && services.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="space-y-2">
                <div className="w-20 h-4 bg-muted rounded" />
                <div className="w-16 h-3 bg-muted rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="w-full h-2 bg-muted rounded-full" />
              <div className="w-3/4 h-2 bg-muted rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lastFetched && `最終更新: ${lastFetched.toLocaleString('ja-JP')}`}
        </p>
        <button
          onClick={fetchUsage}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {error && (
        <div className="bg-muted/50 border border-border text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {services.map((service) => (
          <UsageCard key={service.name} service={service} />
        ))}
      </div>

      {/* 環境変数設定ガイド */}
      {services.some(s => s.status === 'unconfigured') && (
        <div className="bg-muted/50 rounded-lg border p-4 mt-6">
          <h3 className="font-semibold mb-2">環境変数の設定</h3>
          <p className="text-sm text-muted-foreground mb-3">
            使用量を取得するには、各サービスの管理用APIトークンを環境変数に設定してください。
          </p>
          <pre className="bg-card border rounded-lg p-3 text-xs overflow-x-auto">
{`# Vercel
VERCEL_TOKEN=your_vercel_token
# VERCEL_TEAM_ID=team_xxx  # チーム利用時

# Supabase
SUPABASE_ACCESS_TOKEN=sbp_xxx
SUPABASE_PROJECT_REF=your_project_ref

# Cloudflare R2
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Resend（既存のRESEND_API_KEYで動作）`}
          </pre>
        </div>
      )}
    </div>
  )
}
