'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Settings,
  XCircle,
} from 'lucide-react'
import type { ServiceUsage } from '@/lib/services/usage'
import { USAGE_DANGER_THRESHOLD, USAGE_WARNING_THRESHOLD } from '@/lib/constants/limits'

/** サービス名をキーにしたブランドロゴ。lucide に無い独自ロゴのため生 SVG を保持する */
const serviceIcons: Record<string, React.ReactNode> = {
  'fly.io': (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 3.53 2.61 6.43 6 6.92V18H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08c3.39-.49 6-3.39 6-6.92a7 7 0 0 0-7-7Z"/>
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

const serviceColors: Record<string, string> = {
  'fly.io': 'bg-violet-600 text-white',
  Supabase: 'bg-emerald-600 text-white',
  'Cloudflare R2': 'bg-orange-500 text-white',
  Resend: 'bg-black text-white',
}

function UsageCard({ service }: { service: ServiceUsage }) {
  const statusIcon = {
    ok: <CheckCircle2 className="w-5 h-5 text-foreground" />,
    warning: <AlertTriangle className="w-5 h-5 text-muted-foreground" />,
    error: <XCircle className="w-5 h-5 text-destructive" />,
    unconfigured: <Settings className="w-5 h-5 text-muted-foreground" />,
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
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>

      {service.error && (
        <div className="mb-3 p-2 bg-muted/50 rounded text-sm text-destructive">
          {service.error}
        </div>
      )}

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
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

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

      {service.name === 'fly.io' && service.status === 'ok' && (
        <div className="mt-3 p-2 bg-muted/50 border border-border rounded text-xs">
          <p className="text-muted-foreground mb-1">
            請求・コンピュート/帯域などの詳細はダッシュボードで確認してください
          </p>
          <a
            href={service.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground hover:underline font-medium"
          >
            fly.io ダッシュボード
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {service.status === 'ok' && service.helpText && service.name !== 'fly.io' && (
        <p className="text-xs text-muted-foreground mt-3">{service.helpText}</p>
      )}

      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
        更新: {new Date(service.lastUpdated).toLocaleString('ja-JP')}
      </p>
    </div>
  )
}

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
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

      {services.some(s => s.status === 'unconfigured') && (
        <div className="bg-muted/50 rounded-lg border p-4 mt-6">
          <h3 className="font-semibold mb-2">環境変数の設定</h3>
          <p className="text-sm text-muted-foreground mb-3">
            使用量を取得するには、各サービスの管理用APIトークンを環境変数に設定してください。
          </p>
          <pre className="bg-card border rounded-lg p-3 text-xs overflow-x-auto">
{`# fly.io（fly.io 上では FLY_APP_NAME 等が自動注入され基本情報を表示）
FLY_API_TOKEN=your_fly_token  # \`fly tokens create org\` で作成

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
