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
