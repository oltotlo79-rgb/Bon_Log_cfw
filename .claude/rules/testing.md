---
globs: "__tests__/**/*.ts, __tests__/**/*.tsx, e2e/**/*.ts, e2e/**/*.spec.ts, vitest.config.ts, vitest.setup.tsx"
---

# テストルール

## コマンド

```bash
npm test                # ユニットテスト（Vitest）
npm run test:coverage   # カバレッジ付き
npm run test:e2e        # E2Eテスト（Playwright）
npm run test:all        # 全テスト実行
```

## 構成

| ディレクトリ | ツール | 内容 |
|------------|--------|------|
| `__tests__/` | Vitest 4.0.18 | ユニット・コンポーネントテスト（714ファイル） |
| `e2e/` | Playwright 1.57.0 | E2Eテスト（53 specファイル） |

## カバレッジ閾値

| 項目 | 閾値 |
|------|------|
| Branches | 80% |
| Functions | 85% |
| Lines | 85% |
| Statements | 85% |

## テストユーティリティ

- `__tests__/utils/test-utils.tsx` — モックデータ（30+）、`createMockPrismaClient()`
- `__tests__/helpers/action-result.ts` — `expectSuccess`/`expectError` ヘルパー

## テスト必須ルール

- **新機能・バグ修正にはテストを伴う** — コードだけ書いてテストなしはNG
- カバレッジ閾値を下回るPRはCIで失敗する（branches 80%, functions/lines/statements 85%）
- 既存テストが壊れた場合は根本原因を修正する（テストをスキップ・削除しない）

## Server Actionのテストパターン

```typescript
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

// 動的インポートでモジュールキャッシュを回避
const { myAction } = await import('@/lib/actions/my-action')
const result = await myAction(params)
expect(result).toMatchObject({ success: true })
```

## E2E テスト: クリック→ナビゲーションは atomic に待つ

Next.js Link / `router.push` の遷移は hydration / startTransition の遅延を含むため、
`click()` を先に発火させてから `expect(page).toHaveURL(...)` で polling するパターンは
CI で flake / failing になる。

❌ NG (非 atomic):

```typescript
await link.click()
await expect(page).toHaveURL(/\/foo\//, { timeout: 10000 })
```

✅ OK: `e2e/helpers/navigation.ts:clickAndWaitForUrl` で atomic に待機:

```typescript
import { clickAndWaitForUrl } from './helpers/navigation'

await clickAndWaitForUrl(page, link, /\/foo\//)
```

内部的に `Promise.all([page.waitForURL(url), locator.click()])` を実行する。
`waitForURL` を先に仕掛けてからクリックするため、navigation 開始から完了まで補足できる。

ナビゲーション前の hydration 完了が必要な場合は `goto` 後に
`await page.waitForLoadState('networkidle').catch(() => {})` を併用する
(`'load'` だけだと Next.js client side fetch 完了前に進む可能性がある)。
