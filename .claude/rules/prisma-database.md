---
globs: "prisma/**/*.prisma, prisma/**/*.ts, lib/db.ts"
---

# Prisma + PostgreSQL ルール

## シングルトン

`lib/db.ts` でPrismaClientをシングルトン管理。開発時はグローバル変数で接続リーク防止。

## スキーマ規約

- テーブル名: `@@map("snake_case")`
- カラム名: `@map("snake_case")`
- ID: `@id @default(cuid())`
- 日時: `@default(now()) @map("created_at")`, `@updatedAt @map("updated_at")`
- リレーション: `onDelete: Cascade` を明示

## クエリパターン

```typescript
// 読み取り（select/includeで必要なフィールドのみ）
const post = await prisma.post.findUnique({
  where: { id },
  include: {
    user: { select: { id: true, nickname: true, avatarUrl: true } },
    _count: { select: { likes: true, comments: true } },
  },
})

// ネストした作成
const post = await prisma.post.create({
  data: {
    userId, content,
    media: { create: [{ url, type: 'image', sortOrder: 0 }] },
    genres: { create: [{ genreId }] },
  },
})
```

## トランザクション

```typescript
// インタラクティブトランザクション（推奨）
await prisma.$transaction(async (tx) => {
  const item = await tx.model.findUnique({ where: { id } })
  if (!item) throw new Error('Not found')
  await tx.other.create({ data: { ... } })
})
```

## ページネーション（カーソルベース）

```typescript
const items = await prisma.model.findMany({
  take: limit,
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  orderBy: { createdAt: 'desc' },
})
const nextCursor = items.length === limit ? items[items.length - 1]?.id : undefined
```

## N+1クエリ防止

- **ループ内でDBクエリを実行しない** — 事前に `findMany` + `in` で一括取得
- リレーションデータは `include` / `select` で同時取得

```typescript
// ❌ N+1: ループ内でクエリ
for (const post of posts) {
  const user = await prisma.user.findUnique({ where: { id: post.userId } })
}

// ✅ 一括取得
const userIds = posts.map(p => p.userId)
const users = await prisma.user.findMany({ where: { id: { in: userIds } } })

// ✅ include で同時取得（推奨）
const posts = await prisma.post.findMany({
  include: { user: { select: { id: true, nickname: true } } },
})
```

## マイグレーション

```bash
npx prisma db push         # 開発: スキーマを直接反映
npx prisma migrate dev     # 開発: マイグレーションファイル作成
npx prisma migrate deploy  # 本番: マイグレーション適用
```

## 本番マスタデータのピンポイント修正

本番の master / コンテンツデータ（農薬・肥料・ホルモン・辞書等）を一部だけ修正したい場合、
`npm run db:seed`（`prisma/seed/*`）は全件 `deleteMany` → 再構築する破壊的方式のため
本番では使わない。`prisma/scripts/README.md` の手順（dry-run 既定 / `--apply` / 単一
`$transaction` / 冪等 / fail-closed / 限定削除）に従い、対象レコードのみを
`update` / `upsert` するワンショットスクリプトを作成する（`prisma/scripts/_template-oneshot-apply.ts` を雛形として使う）。

## Supabase Data API 非使用方針

DB アクセスは **Prisma の postgres ロール経由のみ**。Supabase Data API (PostgREST `/rest/v1/*`、GraphQL `/graphql/v1`、`supabase-js` クライアント) は一切使用しない。
- `@supabase/supabase-js` 等のクライアント依存追加は禁止（ESLint `no-restricted-imports` で阻止）。
- `https://*.supabase.co/rest/v1/...` や `/graphql/v1/...` への直接 fetch も禁止。
- クライアントから DB に触れる必要がある場合は必ず Server Action 経由。
- 新規テーブル作成時、`anon` / `authenticated` への GRANT は **絶対に付与しない**。`prisma migrate` で生成される CREATE TABLE には自動で grant されないが、Supabase Dashboard の Table Editor / SQL Editor で作った場合は手動 REVOKE が必要。
- `prisma/migrations/20260527000000_revoke_data_api_grants_from_public/` で既存 grant + 将来のデフォルト grant を全て剥がしている (`ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE`)。Dashboard 側でも Exposed schemas/tables を 0 化済み。両者を Defense in Depth として併用する。
