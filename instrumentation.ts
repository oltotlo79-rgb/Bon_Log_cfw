/**
 * Next.js Instrumentation
 *
 * サーバーサイドの初期化処理を行います。
 * CFW 移行に伴い `sentry.{server,edge}.config.ts` への動的 import は削除済 (Phase 2)。
 * 再導入時は `@sentry/cloudflare` の register 方式に従う。
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/**
 * Cloudflare Workers ランタイム判定。
 *
 * Why: OpenNext は build 時に `process.env.NEXT_RUNTIME = "nodejs"` /
 * `NODE_ENV = "production"` を埋め込むため、Workers 上でも本来 nodejs ランタイム用の
 * 起動時処理が走ってしまう。Workers では `env` 引数が per-request で渡される設計のため、
 * 起動時点では `process.env` にユーザー env vars が流れ込んでおらず、env 検証は必ず失敗する。
 *
 * `globalThis.navigator.userAgent === 'Cloudflare-Workers'` は workerd 公式で
 * 必ず true になる ID 文字列。本判定で起動時検証を per-request 検証へフォールバックさせる。
 */
function isCloudflareWorkers(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent === 'string' &&
    (globalThis as { navigator: { userAgent: string } }).navigator.userAgent === 'Cloudflare-Workers'
  )
}

export async function register() {
  // Workers では env が per-request 注入のため、起動時の process.env では検証できない。
  // 検証ロジックは下流 (Server Action / Route Handler / middleware) の実行時に動く同等の
  // ガードに委ねる。
  if (isCloudflareWorkers()) {
    return
  }

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
