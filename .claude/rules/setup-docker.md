---
globs: "docker-compose.yml, Dockerfile, Dockerfile.dev"
---

# 開発環境セットアップ

## 方法1: Docker Composeで一括起動（推奨）

```bash
cp .env.local.example .env.local
docker compose up -d
# http://localhost:3000
docker compose down       # 停止
docker compose down -v    # 停止 + データ削除
```

## 方法2: PostgreSQLのみDockerで起動

```bash
docker compose up -d postgres
cp .env.local.example .env.local
npm install
npx prisma generate
npx prisma db push
npx prisma db seed   # 任意
npm run dev
```

## 方法3: ローカルPostgreSQL

```bash
cp .env.local.example .env.local  # DATABASE_URLを環境に合わせて変更
npm install
npx prisma generate
npx prisma db push
npx prisma db seed   # 任意
npm run dev
```

## Docker Compose プロファイル

```bash
docker compose --profile dev up -d    # PostgreSQL + Next.js(dev)
docker compose --profile prod up -d   # PostgreSQL + Next.js(prod)
docker build -t bonsai-sns .          # イメージのみビルド
```
