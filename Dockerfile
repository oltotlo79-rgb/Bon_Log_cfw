# ===========================================
# BON-LOG Dockerfile
# マルチステージビルドで最適化されたプロダクションイメージ
# ===========================================

# ===========================================
# Stage 1: 依存関係のインストール
# ===========================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# パッケージファイルをコピー
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# 依存関係をインストール
RUN npm ci

# ===========================================
# Stage 2: ビルド
# ===========================================
FROM node:20-alpine AS builder
WORKDIR /app

# 依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prismaクライアントを生成
RUN npx prisma generate

# 環境変数（ビルド時に必要なもの）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Next.jsをビルド
RUN npm run build

# ===========================================
# Stage 3: プロダクション実行
# ===========================================
FROM node:20-alpine AS runner
WORKDIR /app

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 環境変数
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 必要なファイルをコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Prisma エンジンバイナリ（standalone トレースに含まれない場合の保険）
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# standaloneモードの出力をコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 非rootユーザーに切り替え
USER nextjs

# ポート公開
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# アプリケーション起動
CMD ["node", "server.js"]
