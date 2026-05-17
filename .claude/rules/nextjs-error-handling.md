---
globs: "app/**/error.tsx, app/**/not-found.tsx, app/global-error.tsx"
---

# エラーハンドリングルール

## error.tsx

- **`'use client'` 必須**
- `reset` 関数で再試行可能
- 共通の `PageError` コンポーネント（`components/common/PageError.tsx`）を使用
- `PageError` は自動的に Sentry にエラーを送信

```typescript
'use client'
import { PageError } from '@/components/common/PageError'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} title="読み込みに失敗しました" />
}
```

## not-found.tsx

- `notFound()` 関数と連携

```typescript
import { notFound } from 'next/navigation'

export default async function Page({ params }) {
  const item = await getItem(id)
  if (!item) notFound()  // → not-found.tsx を表示
}
```

## global-error.tsx

- ルートレイアウトのエラーをキャッチ（最終防衛線）
- `<html>` と `<body>` を含める必要がある

## 階層

```
global-error.tsx → app/(main)/error.tsx → app/(main)/feed/error.tsx
```

上位のバウンダリが下位でキャッチされなかったエラーを処理する。
