import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/actions/utils'
import {
  API_ERR_UNAUTHORIZED,
  API_ERR_FORBIDDEN,
  API_ERR_INTERNAL_SERVER_ERROR,
  ERR_AUTH_REQUIRED,
  ERR_USAGE_FETCH_FAILED,
  ERR_USAGE_FETCH_FAILED_DETAIL,
  ERR_USAGE_S3_CONNECTION,
} from '@/lib/constants/errors'
import { prisma } from '@/lib/db'
import { listObjects } from '@/lib/storage/s3-sign'
import {
  getVercelUsage,
  getResendUsage,
  type ServiceUsage,
} from '@/lib/services/usage'
import {
  SUPABASE_FREE_TIER_GB,
  SUPABASE_PRICE_PER_GB,
  SUPABASE_PRO_DISK_GB,
  USAGE_ERROR_THRESHOLD,
  USAGE_DANGER_THRESHOLD,
  S3_LIST_OBJECTS_MAX_KEYS,
  BYTES_PER_GB,
  SUPABASE_FREE_TIER_LIMITS,
  USAGE_R2_MAX_FETCH_PAGES,
} from '@/lib/constants/limits'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Supabase Platform API は内部APIで契約外のため、レスポンス形状を信頼せず
// 実際に消費する数値フィールドのみ検証する。欠落・型不一致は undefined に倒し、
// 後段の「usage 0 件なら throw → pg_database_size() フォールバック」で吸収する。
const supabasePlatformUsageSchema = z.object({
  db_size: z.number().optional(),
  disk_usage: z.number().optional(),
  storage_size: z.number().optional(),
})

// Cloudflare R2使用量をS3 APIで正確に取得
async function getCloudflareR2UsageWithS3(): Promise<ServiceUsage> {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    const missing = []
    if (!accountId) missing.push('R2_ACCOUNT_ID')
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID')
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY')
    if (!bucketName) missing.push('R2_BUCKET_NAME')

    return {
      name: 'Cloudflare R2',
      status: 'unconfigured',
      error: `${missing.join(', ')} が未設定`,
      helpText: 'R2 API認証情報を設定してください',
      helpUrl: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
      dashboardUrl: `https://dash.cloudflare.com/${accountId || ''}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const r2Config = {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      accessKeyId,
      secretAccessKey,
      bucket: bucketName,
    }

    // 全オブジェクトを列挙してサイズを合計
    let totalSize = 0
    let totalObjects = 0
    let continuationToken: string | undefined
    let pageCount = 0

    do {
      pageCount++
      const response = await listObjects(r2Config, {
        maxKeys: S3_LIST_OBJECTS_MAX_KEYS,
        continuationToken,
      })

      for (const obj of response.Contents ?? []) {
        totalSize += obj.Size
        totalObjects++
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken && pageCount < USAGE_R2_MAX_FETCH_PAGES)

    if (continuationToken) {
      logger.warn(`R2 listing truncated after ${USAGE_R2_MAX_FETCH_PAGES} pages`)
    }

    const FREE_TIER_GB = SUPABASE_FREE_TIER_GB
    const PRICE_PER_GB = SUPABASE_PRICE_PER_GB

    // Cloudflareと同じ10進法で計算 (1GB = 1,000,000,000 bytes)
    const storageGB = totalSize / BYTES_PER_GB
    const storageMB = totalSize / (BYTES_PER_GB / 1000)

    const usage: ServiceUsage['usage'] = []

    // ストレージ使用量（MBまたはGBで表示）
    if (storageGB >= 1) {
      usage.push({
        current: Math.round(storageGB * 100) / 100,
        limit: FREE_TIER_GB,
        unit: 'GB (ストレージ)',
        percentage: Math.round((storageGB / FREE_TIER_GB) * 100),
      })
    } else {
      // 10進法: 10GB = 10,000 MB
      usage.push({
        current: Math.round(storageMB * 100) / 100,
        limit: FREE_TIER_GB * 1000,
        unit: 'MB (ストレージ)',
        percentage: Math.round((storageMB / (FREE_TIER_GB * 1000)) * 100),
      })
    }

    // オブジェクト数
    usage.push({
      current: totalObjects,
      limit: 0,
      unit: 'オブジェクト',
      percentage: 0,
    })

    // コスト計算
    const billableGB = Math.max(0, storageGB - FREE_TIER_GB)
    const estimatedCost = billableGB * PRICE_PER_GB

    const maxPercentage = Math.max(
      ...usage.filter(u => u.limit > 0).map(u => u.percentage ?? 0),
      0
    )

    return {
      name: 'Cloudflare R2',
      status: maxPercentage >= USAGE_ERROR_THRESHOLD ? 'error' : maxPercentage >= USAGE_DANGER_THRESHOLD ? 'warning' : 'ok',
      usage,
      helpText: estimatedCost > 0
        ? `推定コスト: $${estimatedCost.toFixed(2)}/月 (${SUPABASE_FREE_TIER_GB}GB超過分)`
        : `無料枠内 (${SUPABASE_FREE_TIER_GB}GB/月)`,
      dashboardUrl: `https://dash.cloudflare.com/${accountId}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    logger.error('R2 S3 API error:', error)
    return {
      name: 'Cloudflare R2',
      status: 'error' as const,
      error: ERR_USAGE_S3_CONNECTION,
      dashboardUrl: `https://dash.cloudflare.com/${accountId}/r2/overview`,
      lastUpdated: new Date().toISOString(),
    }
  }
}

// Supabaseの使用量を取得
// 内部APIとpg_database_size()の両方を試す
async function getSupabaseUsageFromDB(): Promise<ServiceUsage> {
  const projectRef = extractProjectRef()
  const orgId = process.env.SUPABASE_ORG_ID
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  const LIMITS = SUPABASE_FREE_TIER_LIMITS

  const dashboardUrl = orgId && projectRef
    ? `https://supabase.com/dashboard/org/${orgId}/usage?projectRef=${projectRef}`
    : 'https://supabase.com/dashboard'

  // 内部APIを試す（ダッシュボードと同じデータソース）
  if (accessToken && projectRef) {
    try {
      const platformUsage = await getSupabaseUsageFromPlatformAPI(projectRef, accessToken, LIMITS, dashboardUrl)
      if (platformUsage.status !== 'error') {
        return platformUsage
      }
      logger.info('Platform API failed, falling back to pg_database_size()')
    } catch (error) {
      logger.info('Platform API error, falling back to pg_database_size():', error)
    }
  }

  return getSupabaseUsageFromDBDirect(projectRef, LIMITS, dashboardUrl)
}

// Supabase内部Platform APIから使用量を取得
async function getSupabaseUsageFromPlatformAPI(
  projectRef: string,
  accessToken: string,
  LIMITS: { dbSizeGB: number; storageSizeGB: number; egressGB: number; mau: number },
  dashboardUrl: string
): Promise<ServiceUsage> {
  // 内部APIエンドポイント（ダッシュボードが使用しているもの）
  const usageUrl = `https://api.supabase.io/platform/projects/${projectRef}/usage`

  const response = await fetch(usageUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    logger.info(`Platform API response: ${response.status}`)
    throw new Error(`Platform API: ${response.status}`)
  }

  const raw: unknown = await response.json()
  logger.info('Platform API response:', JSON.stringify(raw, null, 2))

  const parsed = supabasePlatformUsageSchema.safeParse(raw)
  const data = parsed.success ? parsed.data : {}
  if (!parsed.success) {
    logger.info('Platform API: 想定外のレスポンス形状のため pg_database_size() にフォールバック')
  }

  const usage: ServiceUsage['usage'] = []

  // レスポンス構造を解析
  if (data.db_size !== undefined) {
    const dbSizeGB = data.db_size / (BYTES_PER_GB)
    usage.push({
      current: Math.round(dbSizeGB * 1000) / 1000,
      limit: LIMITS.dbSizeGB,
      unit: 'GB (データベース)',
      percentage: Math.round((dbSizeGB / LIMITS.dbSizeGB) * 100),
    })
  }

  if (data.disk_usage !== undefined) {
    const diskGB = data.disk_usage / (BYTES_PER_GB)
    usage.push({
      current: Math.round(diskGB * 1000) / 1000,
      limit: SUPABASE_PRO_DISK_GB, // Pro default disk
      unit: 'GB (ディスク)',
      percentage: Math.round((diskGB / SUPABASE_PRO_DISK_GB) * 100),
    })
  }

  if (data.storage_size !== undefined) {
    const storageGB = data.storage_size / (BYTES_PER_GB)
    usage.push({
      current: Math.round(storageGB * 1000) / 1000,
      limit: LIMITS.storageSizeGB,
      unit: 'GB (ストレージ)',
      percentage: Math.round((storageGB / LIMITS.storageSizeGB) * 100),
    })
  }

  if (usage.length === 0) {
    throw new Error('Platform API: データ形式が不明')
  }

  const maxPercentage = Math.max(...usage.map(u => u.percentage))

  return {
    name: 'Supabase',
    status: maxPercentage >= USAGE_ERROR_THRESHOLD ? 'error' : maxPercentage >= USAGE_DANGER_THRESHOLD ? 'warning' : 'ok',
    usage,
    helpText: 'Platform API経由で取得',
    dashboardUrl,
    lastUpdated: new Date().toISOString(),
  }
}

// Prismaで直接取得（より正確なディスク使用量）
async function getSupabaseUsageFromDBDirect(
  projectRef: string | undefined,
  LIMITS: { dbSizeGB: number; storageSizeGB: number; egressGB: number; mau: number },
  dashboardUrl: string
): Promise<ServiceUsage> {
  const usage: ServiceUsage['usage'] = []

  try {
    // pg_database_size: データベース全体のサイズ
    const dbSizeResult = await prisma.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) as size
    `

    if (dbSizeResult && dbSizeResult[0]) {
      // pg_database_sizeを使用（これがダッシュボードに最も近い）
      const sizeBytes = Number(dbSizeResult[0].size)
      const currentGB = sizeBytes / (BYTES_PER_GB)

      usage.push({
        current: Math.round(currentGB * 1000) / 1000,
        limit: LIMITS.dbSizeGB,
        unit: 'GB (データベース)',
        percentage: Math.round((currentGB / LIMITS.dbSizeGB) * 100),
      })
    }

    // ユーザー数
    const userCount = await prisma.user.count()
    usage.push({
      current: userCount,
      limit: LIMITS.mau,
      unit: 'MAU (ユーザー数)',
      percentage: Math.round((userCount / LIMITS.mau) * 100),
    })

  } catch (error) {
    logger.error('Supabase DB error:', error)
    return {
      name: 'Supabase',
      status: 'error',
      error: ERR_USAGE_FETCH_FAILED_DETAIL,
      dashboardUrl,
      lastUpdated: new Date().toISOString(),
    }
  }

  const maxPercentage = usage.length > 0 ? Math.max(...usage.map(u => u.percentage)) : 0

  return {
    name: 'Supabase',
    status: maxPercentage >= USAGE_ERROR_THRESHOLD ? 'error' : maxPercentage >= USAGE_DANGER_THRESHOLD ? 'warning' : 'ok',
    usage,
    helpText: '※pg_database_size()による概算値',
    dashboardUrl,
    lastUpdated: new Date().toISOString(),
  }
}

// DATABASE_URLからproject refを抽出
function extractProjectRef(): string | undefined {
  // 直接指定があればそれを使用
  if (process.env.SUPABASE_PROJECT_REF) {
    return process.env.SUPABASE_PROJECT_REF
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return undefined

  // postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com
  const match = dbUrl.match(/postgres\.([a-z0-9]+):/)
  return match ? match[1] : undefined
}

export async function GET() {
  try {
    const adminResult = await requireAdmin()
    if ('error' in adminResult) {
      const isUnauth = adminResult.error === ERR_AUTH_REQUIRED
      return NextResponse.json(
        { error: isUnauth ? API_ERR_UNAUTHORIZED : API_ERR_FORBIDDEN },
        { status: isUnauth ? 401 : 403 }
      )
    }


    // 全サービスの使用量を並列取得
    const results = await Promise.allSettled([
      getVercelUsage(),
      getSupabaseUsageFromDB(), // Prismaを使用
      getCloudflareR2UsageWithS3(), // S3 APIで正確なストレージ取得
      getResendUsage(),
    ])

    const usage = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }

      const names = ['Vercel', 'Supabase', 'Cloudflare R2', 'Resend']
      return {
        name: names[index],
        status: 'error' as const,
        error: ERR_USAGE_FETCH_FAILED,
        dashboardUrl: '#',
        lastUpdated: new Date().toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      data: usage,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Usage API error:', error)
    return NextResponse.json(
      { error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}
