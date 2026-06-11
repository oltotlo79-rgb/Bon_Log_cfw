import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron-auth'
import { CRON_FUNCTION_TIMEOUT_SECONDS } from '@/lib/constants/limits'
import { API_ERR_UNAUTHORIZED, API_ERR_INTERNAL_SERVER_ERROR } from '@/lib/constants/errors'
import { logger } from '@/lib/logger'
import { publishDueScheduledPosts } from '@/lib/services/scheduled-post-publisher'

// Next.js のルートセグメント設定 `maxDuration` は静的解析されるためリテラル値必須。
// 下の `maxDuration = 60` と `CRON_FUNCTION_TIMEOUT_SECONDS` の値が乖離した場合、
// この型代入がコンパイル時に失敗し CI で検出できる。
const _ASSERT_CRON_TIMEOUT_MATCHES: typeof CRON_FUNCTION_TIMEOUT_SECONDS = 60
void _ASSERT_CRON_TIMEOUT_MATCHES

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const timestampHeader = request.headers.get('x-cron-timestamp')

  const authResult = verifyCronAuth(authHeader, timestampHeader, request.nextUrl.pathname)
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error || API_ERR_UNAUTHORIZED }, { status: 401 })
  }

  try {
    const { publishedCount, failedCount } = await publishDueScheduledPosts()

    if (publishedCount === 0 && failedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled posts to publish',
        publishedCount: 0,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Published ${publishedCount} scheduled posts`,
      publishedCount,
      failedCount,
    })
  } catch (error) {
    logger.error('Cron job error (publish-scheduled):', error)
    return NextResponse.json(
      { success: false, error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
/**
 * Vercel Function のタイムアウト（秒）。
 *
 * Next.js はルートセグメント設定 (`maxDuration`) をビルド時に静的解析するため、
 * 定数識別子を直接バインドできない。リテラル値でエクスポートし、実値と
 * `CRON_FUNCTION_TIMEOUT_SECONDS` の一致はファイル冒頭の型アサーションで保証する。
 */
export const maxDuration = 60
