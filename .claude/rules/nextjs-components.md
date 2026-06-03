---
globs: "app/**/*.tsx, components/**/*.tsx"
---

# Next.js コンポーネントルール

## Server Components vs Client Components

- **デフォルトはServer Component** — `'use client'` は以下の場合のみ:
  - `useState`, `useEffect` 等のHooks使用時
  - `onClick`, `onChange` 等のイベントハンドラ使用時
  - ブラウザAPI（`window`, `localStorage`）使用時
- Client Componentは**末端（リーフ）に配置**し、Server Componentでラップ

```typescript
// ❌ ページ全体をClient Componentにしない
'use client'
export default function Page() { ... }

// ✅ インタラクティブ部分のみClient Component
export default async function Page() {
  const data = await getData()
  return <ClientInteractiveSection data={data} />
}
```

## コンポーネント設計原則

1. **Compositionパターン**: Server ComponentからClient Componentに`children`として渡す
2. **シリアライズ**: Client Componentに渡すpropsはシリアライズ可能なもののみ
3. **Suspense**: 重いコンポーネントは`<Suspense>`でラップ

## ファイル規約

各ルートディレクトリで以下のファイルを活用:

| ファイル | 役割 |
|---------|------|
| `page.tsx` | ルートのUI |
| `layout.tsx` | 共有レイアウト（再レンダリングされない） |
| `loading.tsx` | Suspenseフォールバック |
| `error.tsx` | エラーバウンダリ（`'use client'`必須） |
| `not-found.tsx` | 404ページ |

## Route Groups

`(フォルダ名)` でURLに影響を与えずにルートを整理。本プロジェクトの構成:

```
app/
├── (auth)/    # 認証ページ
├── (main)/    # メインアプリ（3カラムレイアウト）
├── (legal)/   # 法務ページ
├── (public)/  # 公開ページ
└── admin/     # 管理者
```

## Dynamic Routes

- `[id]` — 単一の動的セグメント
- `[...slug]` — キャッチオール
- `[[...slug]]` — オプショナルキャッチオール
- Next.js 16 では `params` は `Promise` — 必ず `await params` する

```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

## Metadata

- 静的: `export const metadata: Metadata = { ... }`
- 動的: `export async function generateMetadata({ params }): Promise<Metadata> { ... }`

## Link

- 内部リンクは必ず `next/link` を使用
- 外部リンクは通常の `<a>` タグ

## 型安全性

- **`any` 禁止** — `unknown` + 型ガードか Zod で絞り込む
- **`as` キャスト最小限** — やむを得ない場合はコメントで理由を記載
- Props には明示的な型定義を付ける（`type XxxProps = { ... }`）

## バンドルサイズ

- Server Component にクライアント専用ライブラリ（`leaflet`, `recharts` 等）をインポートしない
- 重いライブラリは `next/dynamic` で遅延読み込み（`nextjs-performance.md` 参照）
- barrel export (`index.ts`) からの部分インポートに注意 — tree-shaking が効かない場合は直接パスで import

## 画像

- 通常は `next/image` を使用 (auto WebP / lazy loading / responsive)
- **例外**: `data:` URL (base64 等) は `next/image` の remote optimization の対象外。
  optimization の必要が無いため、生 `<img>` を許可する。
  - 該当例: `components/settings/two-factor/SetupSection.tsx` の 2FA QR コード
  - 必ず `alt` / `width` / `height` を明示し、`eslint-disable-next-line @next/next/no-img-element`
    に理由コメントを付ける
