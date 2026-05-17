---
globs: "app/**/*.tsx, lib/actions/**/*.ts, lib/cache.ts"
---

# データフェッチング・キャッシュルール

## Server Componentでのデータ取得

- **直接 async/await** を使用（API Route経由しない）
- 複数データは **Promise.all** で並列取得

```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [post, comments] = await Promise.all([getPost(id), getComments(id)])
  return <PostDetail post={post} comments={comments} />
}
```

## キャッシュ戦略

| 方法 | スコープ | 用途 |
|------|---------|------|
| `cache()` (React) | 同一リクエスト内 | 同じデータの重複取得防止 |
| `unstable_cache()` | リクエスト間 | 頻繁にアクセスされる共通データ |
| `revalidatePath()` | ページ単位 | データ変更後のキャッシュ更新 |
| `revalidateTag()` | タグ単位 | 特定データのキャッシュ無効化 |

```typescript
// リクエスト間キャッシュ（lib/cache.ts参照）
export const getCachedGenres = unstable_cache(
  async () => prisma.genre.findMany({ orderBy: { sortOrder: 'asc' } }),
  ['all-genres'],
  { revalidate: 3600, tags: ['genres'] }
)
```

## Streaming と Suspense

- 重いデータ取得を `<Suspense>` でラップして段階的に表示
- `loading.tsx` はページ全体のフォールバック

```typescript
<Suspense fallback={<PostListSkeleton />}>
  <PostList />  {/* async Server Component */}
</Suspense>
```
