/**
 * Next.js Instrumentation
 *
 * サーバーサイドの初期化処理を行います。
 * Sentryの初期化やその他のサーバーサイドツールの設定に使用します。
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 環境変数の起動時バリデーション（不正な設定を早期検出）
    const { validateEnv } = await import('./lib/env-validation')
    validateEnv()

    await import('./sentry.server.config')

    // セキュリティチェックを実行（Node.jsランタイムのみ）
    const { enforceSecurityInProduction } = await import('./lib/security-checks')
    enforceSecurityInProduction()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = async (
  err: { digest: string } & Error,
  request: {
    path: string
    method: string
    headers: { [key: string]: string }
  },
  context: {
    routerKind: 'Pages Router' | 'App Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'middleware'
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering'
    revalidateReason: 'on-demand' | 'stale' | undefined
    renderType: 'dynamic' | 'dynamic-resume'
  }
) => {
  // Sentryにエラーを報告
  const Sentry = await import('@sentry/nextjs')

  Sentry.captureException(err, {
    extra: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      renderSource: context.renderSource,
    },
  })
}
