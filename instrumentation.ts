/**
 * Next.js Instrumentation
 *
 * サーバーサイドの初期化処理を行います。
 * CFW 移行に伴い `sentry.{server,edge}.config.ts` への動的 import は削除済 (Phase 2)。
 * 再導入時は `@sentry/cloudflare` の register 方式に従う。
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 環境変数の起動時バリデーション（不正な設定を早期検出）
    const { validateEnv } = await import('./lib/env-validation')
    validateEnv()

    // セキュリティチェックを実行（Node.jsランタイムのみ）
    const { enforceSecurityInProduction } = await import('./lib/security-checks')
    enforceSecurityInProduction()
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
  const Sentry = await import('@/lib/sentry-shim')

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
