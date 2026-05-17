import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/actions/utils'
import {
  API_ERR_UNAUTHORIZED,
  API_ERR_FORBIDDEN,
  API_ERR_INTERNAL_SERVER_ERROR,
  ERR_AUTH_REQUIRED,
  ERR_SENTRY_TOKEN_MISSING,
  ERR_SENTRY_API_STATUS,
  HELP_SENTRY_TOKEN_SETUP,
  HELP_SENTRY_TOKEN_FORBIDDEN,
  HELP_SENTRY_TOKEN_UNAUTHORIZED,
  HELP_SENTRY_BAD_REQUEST,
  HELP_SENTRY_PROJECT_NOT_FOUND,
} from '@/lib/constants/errors'
import { SENTRY_DEFAULT_ISSUES_LIMIT } from '@/lib/constants/limits'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export interface SentryIssue {
  id: string
  shortId: string
  title: string
  culprit: string
  level: 'error' | 'warning' | 'info' | 'debug' | 'fatal'
  status: string
  count: string
  userCount: number
  firstSeen: string
  lastSeen: string
  permalink: string
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


    // Internal Integration トークン (SENTRY_API_TOKEN) を優先、なければ SENTRY_AUTH_TOKEN を使用
    const authToken = process.env.SENTRY_API_TOKEN || process.env.SENTRY_AUTH_TOKEN
    const org = process.env.SENTRY_ORG || 'bon-log'
    const project = process.env.SENTRY_PROJECT || 'bonsai-sns'

    const dashboardUrl = `https://${org}.sentry.io/issues/`
    const settingsUrl = `https://${org}.sentry.io/settings/developer-settings/`

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: ERR_SENTRY_TOKEN_MISSING,
        helpText: HELP_SENTRY_TOKEN_SETUP,
        helpUrl: settingsUrl,
        dashboardUrl,
      })
    }

    // Sentry API: 組織のIssue一覧を取得（プロジェクトでフィルタ）
    // USリージョンを使用（bon-logはUSリージョン）
    let baseUrl = process.env.SENTRY_API_URL || 'https://us.sentry.io'

    // sntrys_ トークンの場合、埋め込まれたリージョンURLを使用
    if (authToken.startsWith('sntrys_')) {
      try {
        // sntrys_<base64payload>_<signature> の形式
        const parts = authToken.split('_')
        const payloadBase64 = parts[1]
        if (payloadBase64) {
          const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
          if (payload.region_url) {
            baseUrl = payload.region_url
          }
        }
      } catch {
        // Internal Integration トークンの場合はここに来る、USリージョンを使用
      }
    }

    const apiUrl = `${baseUrl}/api/0/organizations/${org}/issues/?query=is:unresolved+project:${project}&limit=${SENTRY_DEFAULT_ISSUES_LIMIT}`

    const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      // サーバーログには詳細を記録（本番環境ではログ管理システムで保護）
      logger.error('Sentry API error:', response.status)

      let helpMessage = ''
      try {
        const errorJson = JSON.parse(errorText)
        // エラー詳細はログのみに記録し、クライアントには返さない
        logger.error('Sentry API error detail:', errorJson.detail || errorText)
      } catch {
        logger.error('Sentry API error detail:', errorText)
      }

      if (response.status === 403) {
        helpMessage = HELP_SENTRY_TOKEN_FORBIDDEN
      } else if (response.status === 401) {
        helpMessage = HELP_SENTRY_TOKEN_UNAUTHORIZED
      } else if (response.status === 400) {
        helpMessage = HELP_SENTRY_BAD_REQUEST
      } else if (response.status === 404) {
        helpMessage = HELP_SENTRY_PROJECT_NOT_FOUND
      }

      // クライアントには一般的なエラー情報のみを返す（機密情報は含めない）
      return NextResponse.json({
        success: false,
        error: ERR_SENTRY_API_STATUS(response.status),
        helpText: helpMessage,
        helpUrl: settingsUrl,
        dashboardUrl,
      })
    }

    const issues: SentryIssue[] = await response.json()

    return NextResponse.json({
      success: true,
      issues: issues.map(issue => ({
        id: issue.id,
        shortId: issue.shortId,
        title: issue.title,
        culprit: issue.culprit,
        level: issue.level,
        status: issue.status,
        count: issue.count,
        userCount: issue.userCount,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        permalink: issue.permalink,
      })),
      dashboardUrl,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Sentry API error:', error)
    return NextResponse.json(
      { error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}
