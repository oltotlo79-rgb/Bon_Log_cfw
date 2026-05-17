import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { SERVER_ACTION_BODY_SIZE_LIMIT } from "./lib/constants/limits";
import { buildImageRemotePatterns } from "./lib/config/image-remote-patterns";

// `initOpenNextCloudflareForDev()` は `next dev` 起動時に wrangler.toml を読み込んで
// R2 / Hyperdrive / Secrets binding を `getCloudflareContext()` 経由で利用可能にする。
//
// Why guard:
//   CI / `next build` 中にも next.config.ts は評価されるが、その時点では
//   wrangler.toml に実 Hyperdrive ID / R2 バケット名が入っていなかった場合
//   wrangler 内部 validation で build が落ちる。
//   `NEXT_PHASE === 'phase-development-server'` (next dev 起動時のみ true) で
//   ガードすることで build / production runtime には副作用ゼロにする。
//   ref: https://nextjs.org/docs/app/api-reference/config/next-config-js#async-configuration
if (process.env.NEXT_PHASE === 'phase-development-server') {
  initOpenNextCloudflareForDev();
}

const analyzeBundles = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Cloudflare Workers では @opennextjs/cloudflare が独自バンドルを行うため
  // standalone も Vercel 用最適化もどちらも不要。Next.js 既定の出力に任せる。
  // 旧 Vercel/Docker のための分岐は CFW 移行で全削除。

  // Vercel 専用の outputFileTracing* も削除 (OpenNext は esbuild で独自バンドル)

  images: {
    // Why this is computed: production では R2 ホスト名を必ず指定させ、未設定時は
    // build を失敗させる (fail-closed)。dev / preview では `*.r2.dev` /
    // `*.r2.cloudflarestorage.com` への wildcard fallback を許容して開発体験を維持する。
    remotePatterns: buildImageRemotePatterns(),
    // 実サイトは 1024px/1280px の PC と 640px の SP が中心。デフォルトの 8 段階は冗長で
    // srcset が肥大するため明示的に絞って CDN キャッシュヒット率を上げる。
    deviceSizes: [640, 750, 1080, 1200, 1920],
    // 固定サイズ画像（アバター・サムネ等）用。小サイズに寄せてバンドル & HTML を削減。
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // CFW では next/image の Image Optimization API は OpenNext がエッジで処理する。
    // dev / Workers 双方で unoptimized=true にして Cloudflare Images 等への移行 (Phase 後半) まで素通しする。
    // ⚠ Phase 5 で再評価予定。production パフォーマンス次第で Cloudflare Images を導入する。
    unoptimized: true,
  },
  experimental: {
    // lucide-react (1000+ アイコン) / date-fns を optimizePackageImports で
    // ツリーシェイキング強化。cold start とバンドルサイズを削減する。
    optimizePackageImports: ['lucide-react', 'date-fns'],
    serverActions: {
      bodySizeLimit: SERVER_ACTION_BODY_SIZE_LIMIT,
    },
  },
};

// CFW 移行版: withSentryConfig は @sentry/cloudflare wrangler plugin に置き換え予定。
// Phase 2 時点では lib/sentry-shim.ts が no-op 化しているため withSentryConfig は外す。
export default analyzeBundles(nextConfig);
