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

/** fly.io Machines REST API のベース URL（GraphQL より machines/volumes 取得が安定） */
const FLYIO_MACHINES_API_BASE = 'https://api.machines.dev/v1'

interface FlyioMachine {
  state?: string
  config?: { guest?: { cpus?: number; memory_mb?: number } }
}

interface FlyioVolume {
  size_gb?: number
}

/**
 * fly.io Machines API からマシン/ボリュームの使用量行を組み立てる。
 * machines は必須（取得失敗で throw し呼び出し側で error 扱い）。
 * volumes は補助情報のため取得失敗しても無視してマシン情報だけ返す。
 */
async function fetchFlyioUsageRows(
  appName: string,
  token: string
): Promise<NonNullable<ServiceUsage['usage']>> {
  const headers = { Authorization: `Bearer ${token}` }
  const rows: NonNullable<ServiceUsage['usage']> = []

  const machinesRes = await fetch(`${FLYIO_MACHINES_API_BASE}/apps/${appName}/machines`, {
    headers,
    next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
  })
  if (!machinesRes.ok) throw new Error(`Machines API HTTP ${machinesRes.status}`)
  const machines = (await machinesRes.json()) as FlyioMachine[]

  const started = machines.filter((m) => m.state === 'started').length
  rows.push({
    current: started,
    limit: machines.length,
    unit: '稼働マシン',
    percentage: machines.length > 0 ? Math.round((started / machines.length) * 100) : 0,
  })

  const totalCpus = machines.reduce((sum, m) => sum + (m.config?.guest?.cpus ?? 0), 0)
  if (totalCpus > 0) {
    rows.push({ current: totalCpus, limit: 0, unit: 'vCPU 合計', percentage: 0 })
  }

  const totalMemoryMb = machines.reduce((sum, m) => sum + (m.config?.guest?.memory_mb ?? 0), 0)
  if (totalMemoryMb > 0) {
    rows.push({ current: totalMemoryMb, limit: 0, unit: 'メモリ合計 (MB)', percentage: 0 })
  }

  try {
    const volumesRes = await fetch(`${FLYIO_MACHINES_API_BASE}/apps/${appName}/volumes`, {
      headers,
      next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
    })
    if (volumesRes.ok) {
      const volumes = (await volumesRes.json()) as FlyioVolume[]
      if (volumes.length > 0) {
        const totalGb = volumes.reduce((sum, v) => sum + (v.size_gb ?? 0), 0)
        rows.push({ current: totalGb, limit: 0, unit: 'ボリューム (GB)', percentage: 0 })
      }
    }
  } catch {
    // volumes は補助情報のため握りつぶす
  }

  return rows
}

/**
 * fly.io の使用状況を取得する。
 *
 * Machines REST API（`api.machines.dev`）でマシン・CPU・メモリ・ボリュームの実数を取得する。
 * 取得には `FLY_API_TOKEN` と `FLY_APP_NAME`（fly.io 上では自動注入）の双方が必要で、
 * 欠ける場合は未設定として設定方法を案内する。請求の詳細は API では取れないためダッシュボード前提。
 */
export async function getFlyioUsage(): Promise<ServiceUsage> {
  const token = process.env.FLY_API_TOKEN || process.env.FLY_ACCESS_TOKEN
  const appName = process.env.FLY_APP_NAME
  const region = process.env.FLY_REGION
  const orgSlug = process.env.FLY_ORG_SLUG
  // 次回請求額の金額は安定した公開 API が無いため、FLY_ORG_SLUG があれば
  // 「次回請求額」ページへ、無ければアプリのダッシュボードへ誘導する。
  const dashboardUrl = orgSlug
    ? `https://fly.io/dashboard/${orgSlug}/billing/invoices/upcoming`
    : appName
      ? `https://fly.io/apps/${appName}`
      : 'https://fly.io/dashboard'
  const lastUpdated = new Date().toISOString()

  if (!token || !appName) {
    return {
      name: 'fly.io',
      status: 'unconfigured',
      error: !token ? ERR_USAGE_FLYIO_TOKEN_MISSING : 'FLY_APP_NAME が未設定',
      helpText: !token
        ? '`fly tokens create org` で作成し `fly secrets set FLY_API_TOKEN=…` で設定すると、マシン・CPU・メモリ・ボリュームの使用量を表示します'
        : 'FLY_APP_NAME が未設定です（fly.io 上では自動注入されます）',
      helpUrl: 'https://fly.io/dashboard/personal/tokens',
      dashboardUrl,
      lastUpdated,
    }
  }

  try {
    const usage = await fetchFlyioUsageRows(appName, token)
    const helpParts: string[] = []
    if (region) helpParts.push(`リージョン: ${region}`)
    helpParts.push('請求の詳細はダッシュボードで確認')
    return {
      name: 'fly.io',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      helpText: helpParts.join(' / '),
      dashboardUrl,
      lastUpdated,
    }
  } catch (error) {
    return {
      name: 'fly.io',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗しました',
      dashboardUrl,
      lastUpdated,
    }
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
