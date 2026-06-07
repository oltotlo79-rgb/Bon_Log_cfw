# テストガイド

このドキュメントでは、BON-LOGプロジェクトのテスト戦略・実行方法・構成について説明します。

## テストフレームワーク

| フレームワーク | バージョン | 用途 | 環境 |
|--------------|-----------|------|------|
| Vitest | ^4.0.18 | ユニット・コンポーネントテスト | jsdom |
| Playwright | ^1.57.0 | E2Eテスト | 8プロジェクト構成 |
| カバレッジプロバイダー | istanbul（`@vitest/coverage-istanbul`） | コードカバレッジ計測 | - |

> **プロバイダー切り替えの経緯**: 旧 `v8` プロバイダーは、コンポーネントテストで `vi.mock('@/lib/actions/*', ...)` が多用される本プロジェクトにおいて、モック対象ファイルの実装側カバレッジを 0 として集計してしまう既知の問題があった。`istanbul` はインスツルメンテーション方式が異なり、`vi.mock()` が呼ばれても実装の別テスト経由のカバレッジが正しく集計される。`@vitest/coverage-v8` も依存に残っているが、`vitest.config.ts` の `coverage.provider` は `istanbul` に固定されている。

Vitest は `vitest.config.ts` で次を設定している:

- `environment: 'jsdom'`、`globals: true`、`setupFiles: ['./vitest.setup.tsx']`
- `testTimeout: 15000`（15秒）、`teardownTimeout: 5000`（5秒）
- `pool: 'forks'` + `maxWorkers: '50%'`（push/ビルドと並走時の flaky を避けるため CPU の半分に制限）

> **`--configLoader runner` について**: `package.json` の test スクリプトは `vitest run --configLoader runner` を使う。Windows sandbox 等で設定ファイル解決が落ちるのを避けるための指定であり、`npm test` 経由なら自動で付与される。`npx vitest run` を直接叩く場合（CI もこちら）はこのフラグは不要。

## テスト統計（2026-06-07時点）

| 項目 | 数値 |
|------|------|
| テストファイル数（Vitest） | 845（`.test.ts` 353 + `.test.tsx` 492） |
| カバレッジ閾値 | Branches 80% / Functions 85% / Lines 85% / Statements 85% |
| カバレッジ実測（参考） | Statements ~96.7% / Branches ~90.9% / Functions ~97.4% / Lines ~98.0%（閾値を大きく上回る） |
| TypeScript strict | `strict: true` + `noUncheckedIndexedAccess: true` + `noImplicitOverride: true` |
| 主要内訳 | components / lib / app / coverage-boost / prisma / hooks / types / 他 |
| E2E specファイル数 | 60 |
| E2E Playwrightプロジェクト数 | 8（setup, chromium, firefox, webkit, Mobile Chrome, Mobile Safari, chromium-noauth, teardown） |
| E2E ワーカー数（CI） | 3（`PLAYWRIGHT_WORKERS` 環境変数で上書き可） |
| パーサーテスト | 6ファイル・98テストケース |
| カバレッジ向上テスト | 24ファイル（__tests__/coverage-boost/） |
| モックオブジェクト数 | 30+（test-utils.tsx） |
| 通知ヘルパーテスト | `__tests__/lib/services/notification-bulk.test.ts`（25 ケース）/ `notification-core.test.ts` |
| Webhook 冪等性テスト | `__tests__/lib/services/webhook-idempotency.test.ts` |
| 2FA 鍵バージョニングテスト | `__tests__/lib/two-factor.test.ts > 鍵バージョン管理` |
| 盆栽手入れログテスト | `__tests__/lib/actions/bonsai-care-log.test.ts` |
| アップロード検証順序テスト | `__tests__/app/api/upload-validation-order.test.ts`（`_shared/validate-upload-file.ts` の共有検証の順序を担保） |
| 辞典カテゴリ定数テスト | `__tests__/lib/constants/dictionary.test.ts`（`constants/dictionary.ts` のカテゴリラベル・配色を検証） |
| Report Server Action 検証テスト | `__tests__/lib/actions/createReport-validation.test.ts`（Zod / 認証順序の境界） |
| Analytics view beacon テスト | `__tests__/app/api/analytics-view-route.test.ts`（`/api/analytics/view` の Zod / dedupe / blocked / 非公開ガード） |
| SEO ガードレールテスト | `__tests__/app/layouts.test.tsx`（layout が canonical を pin しない検証）/ `__tests__/app/root-page.test.tsx`（page metadata 検証） |
| Server Actions ActionResult テスト | `__tests__/lib/actions/analytics-recording.test.ts` 等が `{ success, data?, error? }` 形を厳密検証 |
| 型安全リファクタ追従テスト | `EventForm.branches.test.tsx` / `ShopForm.branches.test.tsx`（discriminated union 化された Form の遷移パスを検証） |

## カバレッジ閾値

| 項目 | 閾値（vitest.config.ts） |
|------|-------------------------|
| Statements | 85% |
| Branches | 80% |
| Functions | 85% |
| Lines | 85% |

> 閾値は CI（`vitest run --coverage`）で強制される。実測値はローカルで `npm run test:coverage` を実行して確認する。

閾値を下回ると `npm run test:coverage` が失敗します。カバレッジレポートは `coverage/` ディレクトリに `text-summary` と `json-summary` 形式で出力されます。

## 型安全性ロードマップ

`tsconfig.json` の `noUncheckedIndexedAccess` および `noImplicitOverride` は **`true` に切り替え済み**。
配列インデックス・`Map.get` の戻り値はすべて `T | undefined` として絞り込みが必須となり、
`?? defaultValue` / 型ガード / discriminated union で各所に防御を入れた状態でビルドが通る。
class 継承時には `override` キーワードが必須。
ESLint も同時に厳格化（`eslint.config.mjs` を参照）。

なお、本番コード（`lib/`, `app/`, `components/`）には **`: any` / `as any` の出現がゼロ**。`as unknown as` は `lib/db.ts`（global Prisma singleton）と `lib/stripe.ts`（Stripe SDK 遅延初期化 Proxy）の **2 箇所のみ**で、いずれもコメントで意図を明記している。本番ファイルの **非 null アサーション (`!.`) は全廃**（discriminated union / Map ガード / `?? []` 等で安全化済み。テストや prisma/seed 等のスクリプトを除く）。`as <Type>` の汎用キャストも極小（`lib/` 全体で 22 件以下、いずれも Object.keys / 列挙体エイリアスや一意フィールド付きキャッシュエントリ等の正当用途）。テストファイル限定で `eslint.config.mjs` が `@typescript-eslint/no-explicit-any` を `off` にしているため、モック定義での `any` 使用は許容される。

## セットアップ

```bash
# 依存関係のインストール
npm install

# Playwrightブラウザのインストール（E2Eテスト用）
npx playwright install
```

## テスト実行コマンド

### ユニットテスト・コンポーネントテスト（Vitest）

```bash
# 全テストを実行（= vitest run --configLoader runner）
npm test

# ウォッチモードで実行（ファイル変更時に自動再実行）
npm run test:watch

# カバレッジレポート付きで実行
npm run test:coverage

# CI相当（カバレッジ付き、非インタラクティブ。中身は test:coverage と同一）
npm run test:ci

# 特定ファイルのみ実行
npx vitest run --configLoader runner __tests__/lib/actions/post.test.ts
```

### E2Eテスト（Playwright）

```bash
# 全E2Eテストを実行
npm run test:e2e

# UIモードで実行（テスト選択・デバッグが可能）
npm run test:e2e:ui

# ブラウザを表示して実行
npm run test:e2e:headed

# デバッグモードで実行
npm run test:e2e:debug

# 特定のテストファイルのみ実行
npx playwright test e2e/auth.spec.ts

# 特定のブラウザのみで実行
npx playwright test --project=chromium
```

**E2Eテストユーザーの作成・削除**
- 通常の `npx prisma db seed` では、**本番（NODE_ENV=production）で実行した場合のみ** E2E用ユーザー（e2e-test@example.com / E2Eテストユーザー）を作成しません。開発・CIでは従来どおり作成されます。
- E2E実行時は **成功・失敗どちらでも** 終了後に teardown が `delete-e2e-test-users` を実行し、テストで作成されたユーザーを削除します。
- **E2E実行時**: `npm run test:e2e` の終了後、teardown で自動削除（globalTeardown も併用）
- **手動で削除**: `npm run e2e:delete-test-users`（接続先DBのE2E用メール・ニックネームのユーザーをすべて削除）
- **本番に残ったE2Eユーザーを削除**: `npm run e2e:delete-production-users`（**本番の DATABASE_URL を指した状態で**実行。実行前に接続先が本番であることを確認すること）

### 全テスト実行

```bash
# ユニットテスト + E2Eテストを順次実行
npm run test:all
```

## テストファイル構成

```
project/
├── __tests__/                    # Vitestテスト（845ファイル）
│   ├── utils/
│   │   └── test-utils.tsx        # テストユーティリティ、モック（30+モックデータ + Prismaクライアントモック）
│   ├── helpers/
│   │   └── action-result.ts      # ActionResult型テスト用ヘルパー（expectSuccess/expectError）
│   ├── api/                      # APIルートテスト
│   ├── app/                      # ページコンポーネントテスト（layouts/root-page も含む）
│   ├── components/               # UIコンポーネントテスト
│   │   ├── ads/, analytics/, auth/, bonsai/, comment/, common/
│   │   ├── dictionary/, draft/, event/, feed/, fertilizer/
│   │   ├── hormone/, layout/, message/, notification/, pesticide/
│   │   ├── post/, report/, search/, settings/, shop/
│   │   ├── subscription/, user/, weather/
│   │   └── coverage-boost*.test.tsx
│   ├── hooks/                    # カスタムフックテスト
│   ├── lib/
│   │   ├── actions/              # Server Actionsテスト（多数。analytics-recording / search-users 等は ActionResult 形に追従）
│   │   ├── constants/            # 定数バリデーションテスト（new-constants.test.ts で MAINTENANCE_CACHE_TTL_MS 等を検証）
│   │   ├── email/                # メールテンプレートテスト
│   │   ├── scraping/             # スクレイパーテスト
│   │   ├── search/               # 全文検索テスト
│   │   ├── security/             # セキュリティテスト
│   │   ├── services/             # サービステスト
│   │   ├── storage/              # ストレージテスト
│   │   ├── utils/                # ユーティリティテスト（admin-cursor / form-data / preserve-order 含む）
│   │   └── validations/          # バリデーションテスト
│   ├── prisma/validation/parsers/ # 農薬CSVパーサーテスト（6ファイル・98ケース）
│   ├── coverage-boost/           # カバレッジ向上テスト（24ファイル）
│   ├── unit/actions/             # 追加ユニットテスト
│   ├── types/                    # 型定義テスト
│   └── proxy/                    # proxy.tsテスト
├── e2e/                          # Playwright E2Eテスト（60 specファイル）
│   ├── auth.setup.ts             # 認証セットアップ（storageState 保存）
│   ├── global-teardown.ts        # 全E2E終了後のクリーンアップ（globalTeardown）
│   ├── teardown.ts               # teardown プロジェクト（chromium等の後に実行）
│   ├── locators.ts               # 共通ロケータ・ヘルパー
│   ├── helpers/
│   │   └── navigation.ts         # clickAndWaitForUrl（クリック→遷移を atomic に待機）
│   └── 60 specファイル:
│       accessibility, admin*, analytics*, auth, block-mute,
│       bonsai*, bookmarks*, comment-*, contact-form, content-*,
│       dictionary*, drafts*, error-handling, events, event-crud,
│       feed, fertilizers, hashtag-navigation, hormones,
│       legal-pages, maintenance, messages*, navigation,
│       notification-actions, notifications*, pesticides, polls,
│       post-interactions, public-pages, quote-repost, report,
│       responsive, scheduled-posts, search, settings*, shops,
│       shop-reviews, social-interactions, subscription,
│       two-factor-auth, user-actions, user-profile*（user-profile-extended を含む）
├── vitest.config.ts              # Vitest設定
├── vitest.setup.tsx              # Vitestセットアップ
└── playwright.config.ts          # Playwright設定（8プロジェクト）
```

## テストの書き方

### Server Actionsのテスト

Server Actionsは `ActionResult` 型（`types/action-result.ts`）で `{ success: true, data? }` または `{ success: false, error }` を返します。テストでは `toMatchObject` や `expectSuccess`/`expectError` ヘルパーでアサートします。

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// レート制限モック（対象 Action が enforceUserRateLimit を通る場合のみ必要）
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

describe('Post Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  it('認証なしの場合はエラーを返す', async () => {
    mockAuth.mockResolvedValue(null)

    // 動的インポートでモジュールキャッシュを回避
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト')

    const result = await createPost(formData)
    expect(result).toMatchObject({ success: false, error: '認証が必要です' })
  })
})
```

#### `'use server'` を持たない RSC データ取得モジュール

`lib/actions/dictionary.ts` / `lib/actions/search-meta.ts` のように **RSC からのみ参照** され client component には公開しない読み取り専用モジュールは、`'use server'` を付けず `'server-only'` ガードのみを置く設計に統一されている。これらは Server Action 規約（ActionResult 必須）の対象外で、戻り値は `{ terms: ... }` 等のドメイン型をそのまま返す。テスト側でも `result.terms` を直接アサートできる。

#### モックの戻り値形

テスト側で `vi.mock('@/lib/actions/search', ...)` のようにバレルをモックする場合は、以下のように **Server Action は ActionResult、データ取得モジュールは生のオブジェクト** を返すよう揃える:

```typescript
vi.mock('@/lib/actions/search', () => ({
  // Server Actions（'use server'）は ActionResult を返す
  searchPosts: vi.fn().mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } }),
  searchUsers: vi.fn().mockResolvedValue({ success: true, data: { users: [], nextCursor: undefined } }),
  searchByTag: vi.fn().mockResolvedValue({ success: true, data: { posts: [], nextCursor: undefined } }),
  // RSC データ取得モジュール（barrel 内で 'use server' 経由で再エクスポートされてはいるが、
  // メタデータ取得系はドメインオブジェクトをそのまま返す）
  getPopularTags: vi.fn().mockResolvedValue({ tags: [] }),
  getAllGenres: vi.fn().mockResolvedValue({ genres: {} }),
}))
```

### コンポーネントテスト

```typescript
import { render, screen, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

describe('MyComponent', () => {
  it('ボタンをクリックするとアクションが実行される', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)

    await user.click(screen.getByRole('button', { name: /送信/i }))

    expect(screen.getByText(/成功/i)).toBeInTheDocument()
  })
})
```

### E2Eテスト

```typescript
import { test, expect } from '@playwright/test'

test.describe('ログイン機能', () => {
  test('ログインページが表示される', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /ログイン/i })).toBeVisible()
    await expect(page.getByLabel(/メールアドレス/i)).toBeVisible()
  })
})
```

#### クリック → ナビゲーションは atomic に待つ（必須パターン）

Next.js Link / `router.push` の遷移は hydration / startTransition の遅延を含むため、
`click()` を先に発火させてから `expect(page).toHaveURL(...)` で polling すると CI で flaky になる。
新規 E2E では `e2e/helpers/navigation.ts` の `clickAndWaitForUrl` を使う
（内部で `Promise.all([page.waitForURL(url), locator.click()])` を実行し、遷移開始〜完了を確実に補足する）。

```typescript
// ❌ NG（非 atomic。CI で flake する）
await link.click()
await expect(page).toHaveURL(/\/feed/, { timeout: 10000 })

// ✅ OK（atomic に待機）
import { clickAndWaitForUrl } from './helpers/navigation'

await clickAndWaitForUrl(page, link, /\/feed/)
```

ナビゲーション前に hydration 完了が必要な場合は `goto` 後に
`await page.waitForLoadState('networkidle').catch(() => {})` を併用する
（`'load'` だけだと client side fetch 完了前に進む可能性がある）。

## モックデータ

テストユーティリティ (`__tests__/utils/test-utils.tsx`) に定義されたモックデータ:

| モック | 説明 |
|-------|------|
| `mockUser` | テスト用ユーザー |
| `mockPost` | テスト用投稿 |
| `mockComment` | テスト用コメント |
| `mockSession` | テスト用セッション |
| `mockGenres` | テスト用ジャンル |
| `mockNotification` | テスト用通知 |
| `mockConversation` | テスト用会話 |
| `mockEvent` | テスト用イベント |
| `mockShop` | テスト用盆栽園 |
| `mockReview` | テスト用レビュー |
| `mockReport` | テスト用通報 |
| `mockAdminUser` | テスト用管理者 |
| `mockMessage` | テスト用メッセージ |
| `mockDraft` | テスト用下書き |
| `mockScheduledPost` | テスト用予約投稿 |
| `mockBonsai` | テスト用盆栽 |
| `mockBonsaiRecord` | テスト用盆栽記録 |
| `mockPasswordResetToken` | テスト用パスワードリセットトークン |
| `mockHashtag` | テスト用ハッシュタグ |
| `mockUserAnalytics` | テスト用ユーザー分析 |
| `mockBlock` | テスト用ブロック |
| `mockMute` | テスト用ミュート |
| `mockFollow` | テスト用フォロー |
| `mockLike` | テスト用いいね |
| `mockBookmark` | テスト用ブックマーク |
| `createMockFormData()` | FormData生成ヘルパー |
| `createMockPrismaClient()` | 完全なPrismaクライアントモック |

## 農薬バリデーションパーサーテスト

`prisma/validation/parsers/` のパーサー群に対する専用テストスイート:

| テストファイル | テスト数 | 検証内容 |
|--------------|---------|---------|
| csv-utils.test.ts | 14 | BOM付きCSV入出力、カンマ/引用符エスケープ、複合キーdedup |
| data-parser.test.ts | 27 | 農薬・成分・効果・病害虫・混用不可・展着剤のパース |
| additions-parser.test.ts | 7 | シングルクォート形式、`as EffectRating`キャスト対応 |
| additions2-parser.test.ts | 10 | `.id`参照、ensureSprayProduct/prisma.findUnique変数対応 |
| spray-parser.test.ts | 6 | スプレー製品のパースと変数マッピング |
| integration.test.ts | 34 | 実シードファイルでの件数検証、MAFF突合データとの正確性照合、効果データの論理整合性、回帰テスト |

**回帰テスト**: カリグリーンの全レベル値、サンヨール液剤ALの11件抽出、混用不可126ペアの石灰硫黄合剤 x マシン油等の重要データが将来壊れないことを保証。

## CI/CD統合

`.github/workflows/ci.yml` は `main` / `master` への push・PR で起動し、5 ジョブ構成（lighthouse は別ワークフロー `lighthouse.yml`）:

| ジョブ | 内容 | 備考 |
|--------|------|------|
| lint | ESLint（`npm run lint`）+ TypeScript型チェック（`npx tsc --noEmit -p tsconfig.check.json`） | - |
| security | `npm audit --json --omit=dev` を ALLOWLIST 突合（未知 high/critical で fail）+ CodeQL静的解析 | - |
| test | ユニットテスト（`npx vitest run --coverage`）。閾値未満で fail。coverage を artifact 化 | - |
| build | Next.js本番ビルド確認（`npm run build`） | - |
| e2e | Playwright E2E（`--project=chromium --project=chromium-noauth`） | `needs: [lint, test, build]`。postgres service + standalone server を起動 |
| lighthouse（別ワークフロー） | Lighthouse CI パフォーマンス監査 | push + PR |

> 注: `npm audit --audit-level=high` ではなく `--json --omit=dev` を `jq` で検査する方式に変わっている（既知 GHSA のみ許容し、未知の high/critical は確実に fail させるため）。

```yaml
# セキュリティスキャン例（npm audit を jq で ALLOWLIST 突合 + CodeQL）
- name: Run npm audit
  run: |
    npm audit --json --omit=dev > audit.json
    # 未知の high/critical advisory があれば exit 1（詳細は ci.yml 参照）
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    languages: javascript-typescript
- name: Perform CodeQL Analysis
  uses: github/codeql-action/analyze@v3

# ユニットテスト実行例（閾値ゲートは vitest 自身が enforce）
- name: Run unit tests (coverage gate enforced)
  run: npx vitest run --coverage
  env:
    NODE_OPTIONS: "--max-old-space-size=4096"
```

## トラブルシューティング

### よくある問題

1. **テストがタイムアウトする**
   - `vitest.config.ts` の `testTimeout` を調整（設定済み15,000ms）
   - E2Eテストは `playwright.config.ts` の `timeout` を調整

2. **モックが動作しない**
   - `vi.clearAllMocks()` を `beforeEach` で呼び出す
   - モジュールのキャッシュをクリア: `vi.resetModules()`

3. **E2Eテストで要素が見つからない**
   - `await expect(element).toBeVisible({ timeout: 10000 })` でタイムアウトを延長
   - ページの読み込みを待つ: `await page.waitForLoadState('networkidle')`

4. **Playwrightブラウザが見つからない**
   ```bash
   npx playwright install
   ```

## 参考リンク

- [Vitest ドキュメント](https://vitest.dev/guide/)
- [Testing Library ドキュメント](https://testing-library.com/docs/)
- [Playwright ドキュメント](https://playwright.dev/docs/intro)
