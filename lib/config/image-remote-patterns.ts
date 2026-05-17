/**
 * @module lib/config/image-remote-patterns
 *
 * `next.config.ts` の `images.remotePatterns` を環境ごとに組み立てるロジック。
 *
 * Why extracted: `next.config.ts` 内の inline 関数だと vitest から import できないため、
 * 「Vercel 本番では実際に使う hostname に絞り、wildcard fallback は使わない」という
 * 信頼境界を回帰テストで守れない。本モジュールに切り出して
 * `__tests__/lib/config/image-remote-patterns.test.ts` で動作を検証する。
 *
 * 優先順位 (上から順に hostname を導出):
 *   1. `R2_PUBLIC_HOSTNAME` (明示指定) — 旧パスとの後方互換
 *   2. `R2_PUBLIC_URL` (`lib/storage/r2-provider.ts` が実 URL 生成に使う env) からホスト抽出
 *   3. `R2_BUCKET_NAME` + `R2_ACCOUNT_ID` から `{bucket}.{account}.r2.dev` を導出
 *      (r2-provider.ts の `R2_PUBLIC_URL` 未設定時のデフォルト URL と一致)
 *   4. wildcard fallback `*.r2.dev` (上記いずれも無い時)
 *
 * `R2_CUSTOM_HOSTNAME` も同様に明示指定 → wildcard fallback `*.r2.cloudflarestorage.com`。
 *
 * 厳格化の判定: `VERCEL_ENV === 'production'`。
 * このとき `R2_PUBLIC_URL` / `R2_PUBLIC_HOSTNAME` / `R2_BUCKET_NAME+R2_ACCOUNT_ID` から
 * hostname を 1 つでも導出できれば、その厳密 hostname だけを許可し wildcard は使わない。
 * 何も導出できないなら、運用上 R2 を使っていないと判断して wildcard fallback を許容する
 * (STORAGE_PROVIDER=local/supabase ケース)。これにより「R2 を使う本番は厳密」「R2 を使わない
 * 本番は通る」両方を成立させる。
 *
 * NODE_ENV ではなく VERCEL_ENV で判定する理由:
 *   `next build` は smoke build (CI / Lighthouse / ローカル `next build` 試行) でも
 *   `NODE_ENV=production` を強制するため、NODE_ENV を見ると CI で必ず厳格化されて落ちる。
 *   `lib/env.ts:getAppUrl` で確立された二層判定パターン (NODE_ENV=presence /
 *   VERCEL_ENV=value strictness) と整合させる。
 */

import type { RemotePattern } from 'next/dist/shared/lib/image-config'

const FALLBACK_R2_HOSTNAME = '*.r2.dev'
const FALLBACK_R2_STORAGE_HOSTNAME = '*.r2.cloudflarestorage.com'

/**
 * `R2_PUBLIC_URL` が URL 文字列として valid であればホスト名を返す。
 * scheme などが壊れていても build を止めないよう失敗時は null を返す。
 */
function extractHostnameFromUrl(url: string | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).hostname || null
  } catch {
    return null
  }
}

/** `R2_BUCKET_NAME` + `R2_ACCOUNT_ID` から `{bucket}.{account}.r2.dev` を組み立てる。両方無ければ null。 */
function deriveR2DefaultHostname(env: NodeJS.ProcessEnv): string | null {
  const bucket = env.R2_BUCKET_NAME?.trim()
  const account = env.R2_ACCOUNT_ID?.trim()
  if (!bucket || !account) return null
  return `${bucket}.${account}.r2.dev`
}

/** R2 公開ホスト名を 1 件だけ導出する (上から順)。導出不可なら null。 */
function resolveR2PublicHostname(env: NodeJS.ProcessEnv): string | null {
  const explicit = env.R2_PUBLIC_HOSTNAME?.trim()
  if (explicit) return explicit
  const fromUrl = extractHostnameFromUrl(env.R2_PUBLIC_URL)
  if (fromUrl) return fromUrl
  return deriveR2DefaultHostname(env)
}

/**
 * `images.remotePatterns` を構築する。
 *
 * Vercel 本番 (`VERCEL_ENV === 'production'`) かつ R2 hostname を 1 つでも導出できる場合は
 * その hostname だけを許可し wildcard fallback は付けない。導出できない場合や非本番では、
 * 設定があれば優先しつつ wildcard fallback も合わせて許可する (CI smoke build が落ちないように)。
 */
export function buildImageRemotePatterns(env: NodeJS.ProcessEnv = process.env): RemotePattern[] {
  const isVercelProd = env.VERCEL_ENV === 'production'
  const r2Public = resolveR2PublicHostname(env)
  const r2Custom = env.R2_CUSTOM_HOSTNAME?.trim()

  const r2Patterns: RemotePattern[] = []
  if (isVercelProd) {
    if (r2Public) {
      r2Patterns.push({ protocol: 'https', hostname: r2Public, pathname: '/**' })
    }
    if (r2Custom) {
      r2Patterns.push({ protocol: 'https', hostname: r2Custom, pathname: '/**' })
    }
    // R2 hostname を 1 つも導出できないケース (R2 を運用していない本番) では、
    // STORAGE_PROVIDER=local/supabase でも `next/image` の remote 検証が他の URL で
    // 落ちないよう wildcard fallback を付与する。
    if (r2Patterns.length === 0) {
      r2Patterns.push({ protocol: 'https', hostname: FALLBACK_R2_HOSTNAME, pathname: '/**' })
      r2Patterns.push({ protocol: 'https', hostname: FALLBACK_R2_STORAGE_HOSTNAME, pathname: '/**' })
    }
  } else {
    // dev / preview / CI / Lighthouse: 環境変数が無くても wildcard で動くようにする。設定があれば優先。
    r2Patterns.push({ protocol: 'https', hostname: r2Public || FALLBACK_R2_HOSTNAME, pathname: '/**' })
    r2Patterns.push({
      protocol: 'https',
      hostname: r2Custom || FALLBACK_R2_STORAGE_HOSTNAME,
      pathname: '/**',
    })
  }

  return [
    ...r2Patterns,
    {
      protocol: 'https',
      hostname: env.SUPABASE_STORAGE_HOSTNAME || '*.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
    {
      protocol: 'https',
      hostname: 'images.unsplash.com',
      pathname: '/**',
    },
  ]
}
