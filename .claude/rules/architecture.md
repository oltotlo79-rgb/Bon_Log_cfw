# アーキテクチャ規約

## レイヤ構造

プロジェクトは 3 層に分かれる。上から下への依存のみ許可、逆方向・横断依存は禁止。

```
┌────────────────────────────────────────────────────────────┐
│  components/, app/    (Presentation)                       │
│  └─ UI / Server Component / Client Component               │
├────────────────────────────────────────────────────────────┤
│  lib/actions/         (Controller + UseCase)               │
│  └─ Server Action: 認証 → Zod → Rate Limit → ロジック      │
├────────────────────────────────────────────────────────────┤
│  lib/services/        (Reusable Domain Logic)              │
│  └─ 複数 Action から呼ばれる再利用ロジック                 │
├────────────────────────────────────────────────────────────┤
│  lib/db.ts, lib/*     (Infrastructure / Utility)           │
│  └─ Prisma / Redis / 環境変数 / 純粋関数                   │
└────────────────────────────────────────────────────────────┘
```

## `lib/actions/` vs `lib/services/` 判断基準

### `lib/actions/` に置く
- **`'use server'` 付きの UI エンドポイント**（Server Action）
- 外部（`components/`）から直接呼ばれる
- 必ず **認証・認可・バリデーション・レート制限** を実施
- 戻り値は `ActionResult<T>`

### `lib/services/` に置く
- **複数の Action から共有される非自明なロジック**
- 例: `createNotificationsBulk`、`authorization.ts`、`comment-notifications.ts`
- 外部（`components/`）から **直接は呼ばれない**
- 認証は呼び出し元（Action）が済ませている前提
- 戻り値は素の値または domain-specific な型

### 判断フロー

```
クライアントから直接呼ぶ？
├─ Yes → lib/actions/{feature}.ts  （Server Action）
└─ No
   ├─ 複数ファイルから呼ばれる再利用ロジック？
   │   └─ Yes → lib/services/{name}.ts
   └─ 単発の計算・変換・定数？
       └─ lib/utils/ or 同じ Action 内の private 関数
```

## `lib/actions/admin/` の扱い

- admin 専用の Server Action は `lib/actions/admin/{feature}.ts` に配置
- **全関数が `requireAdmin(action)` で保護される**こと
- `admin/` 配下は `hasPermission(role, action)` による粒度管理（`lib/admin-permissions.ts`）
- admin 配下で内部的に呼ぶ helper は `lib/services/` に置くこと（admin 配下から他 admin ファイルの未保護 helper を import しない）

## Server Action 必須パターン

レート制限は必ず Zod 検証後に実行する (不正入力でレート制限を消費しないため)。

```typescript
'use server'

export async function myAction(input: MyInput): Promise<ActionResult<MyResult>> {
  // 1) 認証・認可 (レート制限は含まない)
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)

  // 2) Zod によるランタイム検証 (FormData でも typed object でも)
  const parsed = mySchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3) レート制限 (Zod 通過後に実施)
  const rl = await enforceUserRateLimit(auth.userId, 'my_action')
  if (rl) return actionError(rl.error)

  // 4) ビジネスロジック (または services 層へ委譲)
  // 5) revalidatePath() / revalidateTag() でキャッシュ更新
  // 6) actionSuccess(...) で返す
}
```

## 共有コンポーネント

### Prisma include/select
- **3 箇所以上で同じ形になる** `include` / `select` は `lib/prisma/shared-includes.ts` に集約
- 例: `USER_MINIMAL_SELECT`, `USER_MINIMAL_RELATION`, `USER_MINIMAL_WITH_BIO_SELECT`, `GENRE_MINIMAL_SELECT`
- 純粋な Prisma 形状定数のため `lib/services/` / `lib/actions/` 双方から安全に import 可能（依存方向中立）
- 1〜2 箇所でしか使わないものは各ファイル内で定義してよい

### Hooks
- 複数コンポーネントから使う Client 処理は `hooks/use-{name}.ts` に
- 例: `useInfiniteScroll`, `useFollowAction`, `useMediaUpload`

### 定数
- マジックナンバー・マジック文字列は必ず `lib/constants/` 配下に集約
- ドメイン別サブファイル（`limits/`, `errors.ts`, `routes.ts`, `admin-actions.ts`）

#### Next.js Route Segment Config の制約

`export const revalidate` / `export const dynamic` など **Route Segment Config** は
Next.js がビルド時に静的解析するため、**リテラル値以外は受け付けない**
（import された定数はエラーになる）。
意図を示すためにコメントで定数名を併記する:

```ts
// NG: Next.js がビルド失敗
// export const revalidate = REVALIDATE_MASTER_DATA

// OK: リテラル + 識別用コメント
export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当
```

この制約はサーバーサイドのビジネスロジックには適用されない
（`unstable_cache` の `revalidate` オプションは通常の定数で OK）。

## 依存方向の遵守

```
✅ components/ → lib/actions/     // UI が Action を呼ぶ
✅ lib/actions/ → lib/services/   // Action が共有ロジックを使う
✅ lib/services/ → lib/db.ts      // Service が Prisma を使う
❌ lib/actions/ → components/     // Action が UI に依存（禁止）
❌ lib/services/ → lib/actions/   // Service が Action を呼ぶ（循環になる）
❌ lib/actions/admin/* → lib/actions/*（admin 外の未保護関数）  // 権限バイパスのリスク
```

## 拡張時のチェックリスト

新機能 X を追加するとき:

- [ ] `components/{x}/` に UI を配置
- [ ] `lib/actions/{x}.ts` に Server Action を配置
- [ ] 認証/Zod/レート制限 3 点セットを確認
- [ ] 他 Action と共有するロジックがあれば `lib/services/{x}-helpers.ts` に切り出し
- [ ] 定数・制限値を `lib/constants/limits/` に追加
- [ ] テストを `__tests__/lib/actions/{x}.test.ts` に配置
- [ ] `revalidatePath` / `revalidateTag` をキャッシュ境界で呼ぶ

## 既存の逸脱ケース（暫定）

### admin write action のレート制限免除

CLAUDE.md ルール3 は「全 Action で認証 → Zod → レート制限」を要求するが、
`lib/actions/admin/*` の write 系 action（role 変更・ユーザー停止/削除・投稿削除等）は
`enforceUserRateLimit` を**実施しない**（`moderation.ts` のみ例外的に保持）。

**根拠（意図的な免除）:**
- 全 admin action は `requireAdmin(action)` で保護され、`requireAdmin` は JWT を信頼せず
  **毎回 DB を引き直す fresh check**（`utils.ts`）。権限剥奪・停止は既存セッションに即時反映される。
- admin は信頼済みオペレータであり、レート制限の主目的（未認証/一般ユーザーによる濫用・
  credential stuffing・quota 枯渇）が当てはまらない。
- `hasPermission(role, action)` による粒度管理と監査ログ（`adminLog`）で操作は追跡される。

**ルール:** admin 一般 action はレート制限を省略してよい。ただし
**公開・準公開の入力を扱う admin action（例: 公開フォーム由来のモデレーション）には
レート制限を付ける**（`moderation.ts` がその例）。一般ユーザー向け Action は従来どおり 3 点セット必須。

### 許容される `as unknown as` キャストの例外

CLAUDE.md ルール8 は `any` / `as` キャストを禁止するが、以下の 2 箇所は
確立イディオムとして許容する。

- `lib/db.ts:25` — Prisma global singleton（`global as unknown as { prisma: PrismaClient }`）。
  ホットリロード時の接続リーク防止のための Prisma 公式パターン。
- `lib/stripe.ts:29` — 遅延初期化 Proxy の `get` トラップにおけるプロパティ転送
  （`_stripe as unknown as Record<string | symbol, unknown>`）。

**条件:** 該当箇所には理由コメント（モジュールヘッダ JSDoc での説明を含む）を併記すること。

これ以外の `as unknown as` は禁止。Zod 検証または型導出（`as const` / `satisfies`）で解決する。
