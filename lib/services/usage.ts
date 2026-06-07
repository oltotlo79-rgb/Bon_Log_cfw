// 各クラウドサービスの使用量を取得するサービス

import 'server-only'

import {
  R2_BUCKET_LIMIT,
  RESEND_DAILY_EMAIL_LIMIT,
  RESEND_MONTHLY_EMAIL_LIMIT,
  USAGE_DANGER_THRESHOLD,
  USAGE_ERROR_THRESHOLD,
  USAGE_CACHE_REVALIDATE_SECONDS,
  USAGE_MAX_FETCH_PAGES,
  RESEND_EMAILS_PAGE_SIZE,
} from '@/lib/constants/limits'
import { getResendApiKey } from '@/lib/env'
import {
  ERR_USAGE_FLYIO_TOKEN_MISSING,
  ERR_USAGE_RESEND_API_KEY_MISSING,
} from '@/lib/constants/errors'

export interface ServiceUsage {
  name: string
  status: 'ok' | 'warning' | 'error' | 'unconfigured'
  usage?: {
    current: number
    limit: number
    unit: string
    percentage: number
  }[]
  error?: string
  helpText?: string
  helpUrl?: string
  dashboardUrl: string
  lastUpdated: string
}

/**
 * fly.io の使用状況を取得する。
 *
 * fly.io は本番ランタイムで `FLY_APP_NAME` / `FLY_REGION` 等を自動注入するため、
 * トークンが無くても fly.io 上であればアプリ名・リージョンを表示できる。
 * `FLY_API_TOKEN` がある場合は GraphQL API でマシン数を補足する（best-effort、
 * 失敗してもランタイム情報で 'ok' を維持し、ページを壊さない）。請求やコンピュート/
 * 帯域の詳細はダッシュボードで確認する前提とする。
 */
export async function getFlyioUsage(): Promise<ServiceUsage> {
  const token = process.env.FLY_API_TOKEN || process.env.FLY_ACCESS_TOKEN
  const appName = process.env.FLY_APP_NAME
  const region = process.env.FLY_REGION
  const dashboardUrl = appName ? `https://fly.io/apps/${appName}` : 'https://fly.io/dashboard'

  // トークンも無く fly.io ランタイムでもない（ローカル等）場合のみ未設定扱い。
  if (!token && !appName) {
    return {
      name: 'fly.io',
      status: 'unconfigured',
      error: ERR_USAGE_FLYIO_TOKEN_MISSING,
      helpText: '`fly tokens create org` で作成し FLY_API_TOKEN に設定（fly.io 上では基本情報を自動表示）',
      helpUrl: 'https://fly.io/dashboard/personal/tokens',
      dashboardUrl,
      lastUpdated: new Date().toISOString(),
    }
  }

  const usage: ServiceUsage['usage'] = []

  if (token) {
    try {
      const res = await fetch('https://api.fly.io/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: appName
            ? 'query($name: String!) { app(name: $name) { machines { nodes { state } } } }'
            : 'query { apps { nodes { name } } }',
          variables: appName ? { name: appName } : {},
        }),
        next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message || 'GraphQL error')
      }

      if (appName) {
        const machines: { state?: string }[] = json.data?.app?.machines?.nodes ?? []
        const running = machines.filter((m) => m.state === 'started').length
        usage.push({
          current: running,
          limit: machines.length,
          unit: '稼働中マシン / 総数',
          percentage: machines.length > 0 ? Math.round((running / machines.length) * 100) : 0,
        })
      } else {
        const apps: unknown[] = json.data?.apps?.nodes ?? []
        usage.push({ current: apps.length, limit: 0, unit: 'アプリ', percentage: 0 })
      }
    } catch (error) {
      // fly.io 上(FLY_APP_NAME あり)ならランタイム情報で 'ok' を維持。
      // そうでなければ取得失敗を error として表示する。
      if (!appName) {
        return {
          name: 'fly.io',
          status: 'error',
          error: error instanceof Error ? error.message : '取得に失敗',
          dashboardUrl,
          lastUpdated: new Date().toISOString(),
        }
      }
    }
  }

  const helpParts: string[] = []
  if (appName) helpParts.push(`アプリ: ${appName}`)
  if (region) helpParts.push(`リージョン: ${region}`)
  helpParts.push('請求・コンピュート/帯域の詳細はダッシュボードで確認')

  return {
    name: 'fly.io',
    status: 'ok',
    usage: usage.length > 0 ? usage : undefined,
    helpText: helpParts.join(' / '),
    dashboardUrl,
    lastUpdated: new Date().toISOString(),
  }
}

// Cloudflare R2使用量を取得
export async function getCloudflareR2Usage(): Promise<ServiceUsage> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID

  if (!token || !accountId) {
    return {
      name: 'Cloudflare R2',
      status: 'unconfigured',
      error: !token ? 'CLOUDFLARE_API_TOKEN が未設定' : 'R2_ACCOUNT_ID が未設定',
      helpText: 'My Profile → API Tokens で作成（R2の権限が必要）',
      helpUrl: 'https://dash.cloudflare.com/profile/api-tokens',
      dashboardUrl: 'https://dash.cloudflare.com',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const usage: ServiceUsage['usage'] = []

    // バケット一覧を取得
    const bucketsRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
      }
    )

    if (!bucketsRes.ok) {
      const errorData = await bucketsRes.json().catch(() => ({}))
      throw new Error(errorData.errors?.[0]?.message || `HTTP ${bucketsRes.status}`)
    }

    const bucketsData = await bucketsRes.json()
    const buckets = bucketsData.result || []

    // 数値を確実に保証
    const safeBucketCount = Array.isArray(buckets) ? buckets.length : 0

    // バケット数
    usage.push({
      current: safeBucketCount,
      limit: R2_BUCKET_LIMIT,
      unit: 'バケット',
      percentage: Math.round((safeBucketCount / R2_BUCKET_LIMIT) * 100),
    })

    return {
      name: 'Cloudflare R2',
      status: 'ok',
      usage,
      helpText: 'ストレージ使用量(10GB無料)はダッシュボードで確認',
      dashboardUrl: `https://dash.cloudflare.com/${accountId}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Cloudflare R2',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗',
      dashboardUrl: 'https://dash.cloudflare.com',
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Resend使用量を取得
export async function getResendUsage(): Promise<ServiceUsage> {
  const apiKey = getResendApiKey()

  if (!apiKey) {
    return {
      name: 'Resend',
      status: 'unconfigured',
      error: ERR_USAGE_RESEND_API_KEY_MISSING,
      helpText: 'API Keys で作成',
      helpUrl: 'https://resend.com/api-keys',
      dashboardUrl: 'https://resend.com/emails',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const usage: ServiceUsage['usage'] = []

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    let allEmails: { created_at: string }[] = []
    let hasMore = true
    let cursor: string | undefined

    for (let i = 0; i < USAGE_MAX_FETCH_PAGES && hasMore; i++) {
      const emailsUrl = cursor
        ? `https://api.resend.com/emails?limit=${RESEND_EMAILS_PAGE_SIZE}&cursor=${cursor}`
        : `https://api.resend.com/emails?limit=${RESEND_EMAILS_PAGE_SIZE}`

      const emailsRes = await fetch(emailsUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
      })

      if (!emailsRes.ok) {
        if (emailsRes.status === 404) {
          break
        }
        throw new Error(`HTTP ${emailsRes.status}`)
      }

      const emailsData = await emailsRes.json()

      if (emailsData.data && Array.isArray(emailsData.data)) {
        allEmails = [...allEmails, ...emailsData.data]

        const oldestEmail = emailsData.data[emailsData.data.length - 1]
        if (oldestEmail && new Date(oldestEmail.created_at) < monthStart) {
          hasMore = false
        } else if (emailsData.data.length < RESEND_EMAILS_PAGE_SIZE) {
          hasMore = false
        } else {
          cursor = emailsData.data[emailsData.data.length - 1]?.id
        }
      } else {
        hasMore = false
      }
    }

    const todayCount = allEmails.filter(
      email => new Date(email.created_at) >= todayStart
    ).length

    const monthCount = allEmails.filter(
      email => new Date(email.created_at) >= monthStart
    ).length

    usage.push({
      current: todayCount,
      limit: RESEND_DAILY_EMAIL_LIMIT,
      unit: '通 (今日)',
      percentage: Math.round((todayCount / RESEND_DAILY_EMAIL_LIMIT) * 100),
    })

    usage.push({
      current: monthCount,
      limit: RESEND_MONTHLY_EMAIL_LIMIT,
      unit: '通 (今月)',
      percentage: Math.round((monthCount / RESEND_MONTHLY_EMAIL_LIMIT) * 100),
    })

    const maxPercentage = Math.max(...usage.map(u => u.percentage))

    return {
      name: 'Resend',
      status: maxPercentage >= USAGE_ERROR_THRESHOLD ? 'error' : maxPercentage >= USAGE_DANGER_THRESHOLD ? 'warning' : 'ok',
      usage,
      dashboardUrl: 'https://resend.com/overview',
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Resend',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗',
      dashboardUrl: 'https://resend.com/emails',
      lastUpdated: new Date().toISOString(),
    }
  }
}
