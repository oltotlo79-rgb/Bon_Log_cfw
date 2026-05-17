---
globs: "lib/actions/**/*.ts"
---

# Server Actions ルール

## 必須パターン

すべての Server Action は以下の順序で処理する。
レート制限は必ず Zod 検証後に行う (不正入力でレート制限を消費しないため)。

```typescript
'use server'

export async function myAction(params) {
  // 1. 認証 + 非ゲスト (レート制限は含まない)
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. Zod バリデーション
  const parsed = schema.safeParse(params)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. レート制限 (Zod 通過後に実施)
  const rl = await enforceUserRateLimit(userId, 'action_type')
  if (rl) return actionError(rl.error)

  // 4. ビジネスロジック (Prisma 操作)
  // 5. キャッシュ無効化: revalidatePath() / revalidateTag()
  // 6. ActionResult で返却
  return actionSuccess({ ... })
}
```

## ActionResult 型

`types/action-result.ts` の `ActionResult<T>` 型と `actionSuccess`/`actionError` ヘルパーを使用:

```typescript
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

### ActionResult を使わない例外

以下のパターンに該当する読み取り Server Action は、`ActionResult<T>` ではなく
`{ data: T[]; nextCursor?: string; error?: string }` 形式を返してよい。

- オートコンプリート / 検索系で、UI 上 fallback として空配列が自然なもの
- カーソル付きリスト取得で、`error` を別フィールドで返す方が呼び出し側を簡潔にできるもの

例: `lib/actions/search-entities.ts`、`lib/actions/mention.ts:searchMentionUsers`、
`lib/actions/hashtag.ts:getTrendingHashtags`。

新規関数を例外として追加する場合は、ファイル冒頭の `@module` JSDoc に
「Returns custom shape instead of ActionResult because ...」と理由を明記すること。

## エラーメッセージ

- `lib/constants/errors.ts` の定数を使用する（インライン文字列を使わない）
- 動的パラメータにはテンプレート関数（`ERR_POST_CONTENT_TOO_LONG(max)`）を使用

## マジックナンバー・定数

- 数値リテラル（制限値、タイムアウト等）をコードに直書きしない
- `lib/constants/limits/` の定数を使用。新規追加時は適切なサブファイルに配置
- エラー文字列は `lib/constants/errors.ts`、ルートパスは `lib/constants/routes.ts`

```typescript
// ❌ マジックナンバー
if (count >= 20) return actionError('1日の投稿上限に達しました')

// ✅ 定数を使用
import { DAILY_POST_LIMIT } from '@/lib/constants/limits'
import { ERR_DAILY_POST_LIMIT } from '@/lib/constants/errors'
if (count >= DAILY_POST_LIMIT) return actionError(ERR_DAILY_POST_LIMIT(DAILY_POST_LIMIT))
```

## 通知

- `prisma.notification.create` を直接呼ばず、`@/lib/services/notification-core` の `createNotification()` を使用
- `'use server'` ファイルからは公開しない (RPC 公開しないため services 層に置く)

## 既存ヘルパーの再利用

新しい Action を書く前に、以下に同等機能がないか確認する:
- `lib/actions/utils.ts` — `requireAuth`, `requireActiveNonGuestUser`, `enforceUserRateLimit`, `checkDailyPostLimit`, `validateMediaCounts`
- `lib/actions/filter-helper.ts` — `getExcludedUserIds`, `getMutedUserIds`, `getBlockedUserIds`
- `lib/actions/post-helpers.ts` — `checkDailyPostLimit`, メディアバリデーション
- `lib/actions/post-include.ts` — `POST_LIST_INCLUDE`, `formatPostForClient`

## セキュリティ

- Server Actionsでは**必ず認証・認可チェック**
- ユーザー入力は**必ずZodバリデーション**
- 機密情報は環境変数（`NEXT_PUBLIC_` なしはサーバーのみ）
