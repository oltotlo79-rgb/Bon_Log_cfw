// 各クラウドサービスの使用量を取得するサービス

import 'server-only'

import {
  VERCEL_PRO_DEPLOY_LIMIT,
  VERCEL_PRO_PROJECT_LIMIT,
  R2_BUCKET_LIMIT,
  RESEND_DAILY_EMAIL_LIMIT,
  RESEND_MONTHLY_EMAIL_LIMIT,
  USAGE_DANGER_THRESHOLD,
  USAGE_ERROR_THRESHOLD,
  USAGE_CACHE_REVALIDATE_SECONDS,
  USAGE_MAX_FETCH_PAGES,
  VERCEL_API_PAGE_SIZE,
  RESEND_EMAILS_PAGE_SIZE,
} from '@/lib/constants/limits'
import { getResendApiKey } from '@/lib/env'
import {
  ERR_USAGE_VERCEL_TOKEN_MISSING,
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

// Vercel使用量を取得
export async function getVercelUsage(): Promise<ServiceUsage> {
  const token = process.env.VERCEL_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token) {
    return {
      name: 'Vercel',
      status: 'unconfigured',
      error: ERR_USAGE_VERCEL_TOKEN_MISSING,
      helpText: 'Vercel Account Settings → Tokens で作成',
      helpUrl: 'https://vercel.com/account/tokens',
      dashboardUrl: 'https://vercel.com/dashboard',
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const usage: ServiceUsage['usage'] = []

    // ユーザー情報からチームIDを取得（設定されていない場合）
    let resolvedTeamId = teamId
    if (!resolvedTeamId) {
      const userRes = await fetch('https://api.vercel.com/www/user', {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        resolvedTeamId = userData.user?.defaultTeamId
      }
    }

    // デプロイ数を取得（今月）
    const deploymentsUrl = resolvedTeamId
      ? `https://api.vercel.com/v6/deployments?teamId=${resolvedTeamId}&limit=${VERCEL_API_PAGE_SIZE}`
      : `https://api.vercel.com/v6/deployments?limit=${VERCEL_API_PAGE_SIZE}`

    const deploymentsRes = await fetch(deploymentsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
    })

    if (deploymentsRes.ok) {
      const deploymentsData = await deploymentsRes.json()
      const deployments = deploymentsData.deployments || []

      // 今月のデプロイ数をカウント
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthlyDeployments = deployments.filter(
        (d: { created: number }) => new Date(d.created) >= monthStart
      ).length

      // Pro: 無制限だが目安として表示
      usage.push({
        current: monthlyDeployments,
        limit: VERCEL_PRO_DEPLOY_LIMIT,
        unit: 'デプロイ (今月)',
        percentage: Math.min(Math.round((monthlyDeployments / VERCEL_PRO_DEPLOY_LIMIT) * 100), 100),
      })
    }

    // プロジェクト数を取得
    const projectsUrl = resolvedTeamId
      ? `https://api.vercel.com/v9/projects?teamId=${resolvedTeamId}&limit=${VERCEL_API_PAGE_SIZE}`
      : `https://api.vercel.com/v9/projects?limit=${VERCEL_API_PAGE_SIZE}`

    const projectsRes = await fetch(projectsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
    })

    if (projectsRes.ok) {
      const projectsData = await projectsRes.json()
      const projectCount = projectsData.projects?.length || 0

      usage.push({
        current: projectCount,
        limit: VERCEL_PRO_PROJECT_LIMIT,
        unit: 'プロジェクト',
        percentage: Math.round((projectCount / VERCEL_PRO_PROJECT_LIMIT) * 100),
      })
    }

    // ダッシュボードURL（チームの場合はチームページ）
    let dashboardUrl = 'https://vercel.com/account/usage'
    if (resolvedTeamId) {
      // チーム名を取得してURLを構築
      const teamsRes = await fetch(`https://api.vercel.com/v2/teams/${resolvedTeamId}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: USAGE_CACHE_REVALIDATE_SECONDS },
      })
      if (teamsRes.ok) {
        const teamData = await teamsRes.json()
        dashboardUrl = `https://vercel.com/${teamData.slug || teamData.name}/~/usage`
      }
    }

    return {
      name: 'Vercel',
      status: 'ok',
      usage: usage.length > 0 ? usage : undefined,
      helpText: 'Pro プラン - データ転送量はダッシュボードで確認',
      dashboardUrl,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Vercel',
      status: 'error',
      error: error instanceof Error ? error.message : '取得に失敗',
      dashboardUrl: 'https://vercel.com/dashboard',
      lastUpdated: new Date().toISOString(),
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
