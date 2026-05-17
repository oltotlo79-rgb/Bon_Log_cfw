---
globs: "app/**/*.tsx, components/**/*.tsx, next.config.ts"
---

# パフォーマンス最適化ルール

## Image最適化

- **必ず `next/image` を使用**（自動WebP変換、遅延読み込み）
- LCP画像には `priority` を付与
- 外部画像は `next.config.ts` の `remotePatterns` で許可

```typescript
import Image from 'next/image'

<Image src={url} alt="説明" width={600} height={400}
  sizes="(max-width: 768px) 100vw, 600px" />
```

## Dynamic Import

- 重いライブラリは `next/dynamic` で遅延読み込み
- SSR不要なコンポーネント（Leaflet地図等）は `ssr: false`

```typescript
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/shop/Map'), {
  ssr: false,
  loading: () => <MapSkeleton />
})
```

## React Cache

```typescript
import { cache } from 'react'

// 同一リクエスト内でメモ化
export const getUser = cache(async (id: string) => {
  return prisma.user.findUnique({ where: { id } })
})
```

## memo

- 親の状態更新が頻繁なコンポーネントでは `React.memo` で不要な再レンダリング防止
- 純粋な表示コンポーネント（アイコン、バッジ等）に有効
