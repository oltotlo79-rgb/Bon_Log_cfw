'use client'

// ReactのuseStateとuseEffectフック
import { useState, useEffect } from 'react'
// 日付のフォーマット用ユーティリティ（相対時間表示）
import { formatDistanceToNow } from 'date-fns'
// 日本語ロケール
import { ja } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'

interface SentryIssue {
  /** イシューの一意識別子 */
  id: string
  /** 短縮ID（表示用） */
  shortId: string
  /** エラータイトル */
  title: string
  /** エラー発生箇所（関数名やファイルパス） */
  culprit: string
  /** エラーレベル（error, warning, info, debug, fatal） */
  level: 'error' | 'warning' | 'info' | 'debug' | 'fatal'
  /** イシューのステータス */
  status: string
  /** 発生回数 */
  count: string
  /** 影響を受けたユーザー数 */
  userCount: number
  /** 最初の発生日時 */
  firstSeen: string
  /** 最後の発生日時 */
  lastSeen: string
  /** Sentryダッシュボードへの直リンク */
  permalink: string
}

interface SentryResponse {
  /** 取得成功フラグ */
  success: boolean
  /** イシューのリスト */
  issues?: SentryIssue[]
  /** エラーメッセージ */
  error?: string
  /** ヘルプテキスト */
  helpText?: string
  /** ヘルプURL */
  helpUrl?: string
  /** SentryダッシュボードのURL */
  dashboardUrl?: string
  /** データ取得日時 */
  fetchedAt?: string
  /** デバッグ情報 */
  debug?: {
    url?: string
    tokenLength?: number
    tokenPrefix?: string
    org?: string
    project?: string
  }
}

/**
 * アラートサークルアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" x2="12" y1="8" y2="12"/>
      <line x1="12" x2="12.01" y1="16" y2="16"/>
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
 * リフレッシュ/更新アイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  )
}

/**
 * エラーレベルに応じた色クラスを返す関数
 * @param level - エラーレベル
 * @returns Tailwind CSSの色クラス
 */
function getLevelColor(level: string) {
  switch (level) {
    case 'fatal':
      return 'bg-muted text-muted-foreground border-border'
    case 'error':
      return 'bg-muted text-muted-foreground border-border'
    case 'warning':
      return 'bg-muted text-muted-foreground border-border'
    case 'info':
      return 'bg-muted text-muted-foreground border-border'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

/**
 * エラーレベルの日本語ラベルを返す関数
 * @param level - エラーレベル
 * @returns 日本語のラベル
 */
function getLevelLabel(level: string) {
  switch (level) {
    case 'fatal':
      return '致命的'
    case 'error':
      return 'エラー'
    case 'warning':
      return '警告'
    case 'info':
      return '情報'
    default:
      return level
  }
}

/**
 * Sentryエラー表示コンポーネント
 * 管理者ダッシュボードに未解決のSentryエラーを表示する
 *
 * @returns Sentryエラーリストを含むカード要素
 *
 * 処理内容:
 * 1. コンポーネントマウント時にSentry APIからエラー情報を取得
 * 2. ローディング中はスピナーを表示
 * 3. エラー時はエラーメッセージとヘルプリンクを表示
 * 4. 成功時はエラーリストを表示（発生回数、最終発生日時付き）
 * 5. 手動更新ボタンでデータを再取得可能
 */
export function SentryErrors() {
  // Sentryレスポンスデータの状態
  const [data, setData] = useState<SentryResponse | null>(null)
  // ローディング状態
  const [loading, setLoading] = useState(true)

  /**
   * Sentry APIからエラー情報を取得する関数
   * /api/admin/sentry エンドポイントを呼び出す
   */
  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sentry')
      const json = await res.json()
      setData(json)
    } catch {
      setData({ success: false, error: '取得に失敗しました' })
    } finally {
      setLoading(false)
    }
  }

  // コンポーネントマウント時にデータ取得
  useEffect(() => {
    fetchData()
  }, [])

  // ローディング中の表示
  if (loading) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg">
            <AlertCircleIcon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold">Sentryエラー</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  // エラー時またはデータ取得失敗時の表示
  if (!data?.success) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted/30 text-muted-foreground rounded-lg">
              <AlertCircleIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Sentryエラー</h2>
          </div>
          {data?.dashboardUrl && (
            <a
              href={data.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
            >
              Sentry <ExternalLinkIcon className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">{data?.error}</p>
          {data?.helpText && (
            <p className="text-sm text-muted-foreground mt-1">{data.helpText}</p>
          )}
          {data?.debug && (
            <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
              <p>URL: {data.debug.url}</p>
              <p>Token: {data.debug.tokenPrefix}... (長さ: {data.debug.tokenLength})</p>
              <p>Org: {data.debug.org} / Project: {data.debug.project}</p>
            </div>
          )}
          {data?.helpUrl && (
            <a
              href={data.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline mt-2"
            >
              トークンを作成 <ChevronRight className="h-4 w-4 inline-block shrink-0" aria-hidden />
            </a>
          )}
        </div>
      </div>
    )
  }

  // 取得したイシューリスト
  const issues = data.issues || []

  // 成功時のエラーリスト表示
  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg">
            <AlertCircleIcon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold">Sentryエラー</h2>
          {issues.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-foreground text-background rounded-full">
              {issues.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="更新"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
          <a
            href={data.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
          >
            Sentry <ExternalLinkIcon className="w-3 h-3" />
          </a>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>未解決のエラーはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <a
              key={issue.id}
              href={issue.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getLevelColor(issue.level)}`}>
                      {getLevelLabel(issue.level)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {issue.shortId}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{issue.title}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {issue.culprit}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>{issue.count}回</p>
                  <p className="mt-1">
                    {formatDistanceToNow(new Date(issue.lastSeen), {
                      addSuffix: true,
                      locale: ja,
                    })}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
