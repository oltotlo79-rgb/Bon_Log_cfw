import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { SERVER_ACTION_BODY_SIZE_LIMIT } from "./lib/constants/limits";
import { buildImageRemotePatterns } from "./lib/config/image-remote-patterns";

const analyzeBundles = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // standalone は Docker/自己ホスト用。Vercel では独自最適化が入るため無効化
  output: process.env.VERCEL ? undefined : 'standalone',

  // Vercel サーバーレス関数の 250 MB 制限対策
  // 本番ビルドに不要なファイルをファイルトレースから除外する
  outputFileTracingExcludes: {
    '*': [
      // Prisma: 非Linux プラットフォーム向けエンジンバイナリを除外
      'node_modules/.prisma/client/libquery_engine-darwin*',
      'node_modules/.prisma/client/libquery_engine-windows*',
      'node_modules/.prisma/client/query_engine-windows*',
      'node_modules/@prisma/engines/libquery_engine-darwin*',
      'node_modules/@prisma/engines/libquery_engine-windows*',
      'node_modules/@prisma/engines/query_engine-windows*',
      'node_modules/@prisma/engines/introspection-engine*',
      'node_modules/@prisma/engines/migration-engine*',
      'node_modules/@prisma/engines/prisma-fmt*',
      'node_modules/@prisma/engines/schema-engine*',
      // 静的画像: サーバーレス関数にバンドル不要（CDNから配信）
      'public/images/pesticides/**',
      'public/images/pests/**',
      // 開発・シードファイル（ランタイムに不要）
      'prisma/seed*.ts',
      'prisma/migrations/**',
      // テスト関連
      '__tests__/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      'e2e/**',
    ],
  },

  // Prisma 6 (engineType="client") はクエリコンパイラを WASM で実行する。
  // Next.js の file tracing は require() グラフしか追わないため、動的に読まれる
  // *.wasm / schema.prisma は自動検出されず Vercel の serverless bundle から
  // 抜け落ちる。本番で `ENOENT: query_compiler_bg.wasm` を起こさないよう明示的に含める。
  outputFileTracingIncludes: {
    '*': [
      'node_modules/.prisma/client/*.wasm',
      'node_modules/.prisma/client/schema.prisma',
    ],
  },

  images: {
    // Why this is computed: production では R2 ホスト名を必ず指定させ、未設定時は
    // build を失敗させる (fail-closed)。dev / preview では `*.r2.dev` /
    // `*.r2.cloudflarestorage.com` への wildcard fallback を許容して開発体験を維持する。
    // 共有ドメイン全体への最適化リクエストを production で出すことは SSRF/コスト面で
    // 望ましくないため、本番だけ厳格化する。
    remotePatterns: buildImageRemotePatterns(),
    // 実サイトは 1024px/1280px の PC と 640px の SP が中心。デフォルトの 8 段階は冗長で
    // srcset が肥大するため明示的に絞って CDN キャッシュヒット率を上げる。
    deviceSizes: [640, 750, 1080, 1200, 1920],
    // 固定サイズ画像（アバター・サムネ等）用。小サイズに寄せてバンドル & HTML を削減。
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // 開発環境でのプライベートIP制限を回避
    unoptimized: process.env.NODE_ENV === 'development',
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

export default withSentryConfig(analyzeBundles(nextConfig), {
  // Sentry組織とプロジェクト設定（環境変数で上書き可能）
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // ソースマップのアップロード設定
  silent: !process.env.CI, // CI以外ではログを抑制
  widenClientFileUpload: true,

  // Next.js内部ファイル（ソースマップなし）の警告を抑制
  sourcemaps: {
    ignore: [
      '**/node_modules/**',
      '**/*_client-reference-manifest*',
      '**/*-manifest.js',  // 全てのmanifestファイルを除外
    ],
  },

  // パフォーマンス最適化
  tunnelRoute: '/monitoring', // Ad blockerを回避するトンネルルート
});
