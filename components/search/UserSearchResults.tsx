'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { searchUsers } from '@/lib/actions/search'
import { DEFAULT_PAGE_LIMIT, STALE_TIME_SEARCH_MS } from '@/lib/constants/limits'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'

type User = {
  /** ユーザーID */
  id: string
  /** ニックネーム（表示名） */
  nickname: string
  /** アバター画像URL */
  avatarUrl: string | null
  /** 自己紹介文 */
  bio: string | null
  /** フォロワー数 */
  followersCount: number
  /** フォロー中の数 */
  followingCount: number
}

type UserSearchResultsProps = {
  /** 検索キーワード（ニックネーム、bio等で検索） */
  query: string
  /** 初期表示用のユーザーデータ */
  initialUsers?: User[]
}

/**
 * ユーザー検索結果コンポーネント
 *
 * ニックネームや自己紹介文でユーザーを検索し、結果を一覧表示。
 * 無限スクロールに対応し、ユーザーカードをクリックするとプロフィールページに遷移。
 */
export function UserSearchResults({ query, initialUsers }: UserSearchResultsProps) {
  type SearchUsersPage = { users: User[]; nextCursor: string | undefined }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['search-users', query],

    queryFn: async ({ pageParam }): Promise<SearchUsersPage> => {
      const result = await searchUsers(query, pageParam)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data ?? { users: [], nextCursor: undefined }
    },

    initialPageParam: undefined as string | undefined,

    // initialUsers が配列ならサーバー fetched 済みと判断し initialData を渡して即時描画。
    // undefined はクライアント fetch 待ち（unit test 等）。
    initialData: initialUsers !== undefined ? {
      pages: [{
        users: initialUsers,
        nextCursor: initialUsers.length >= DEFAULT_PAGE_LIMIT ? initialUsers[initialUsers.length - 1]?.id : undefined,
      } satisfies SearchUsersPage],
      pageParams: [undefined],
    } : undefined,

    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: STALE_TIME_SEARCH_MS,
  })

  const { ref } = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage })

  if (isLoading) {
    return <SearchResultsSkeleton />
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        {error.message || '検索中にエラーが発生しました'}
      </div>
    )
  }

  const allUsers = data?.pages.flatMap((page) => page.users) || []

  if (allUsers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {query ? `「${query}」に一致するユーザーはいません` : 'ユーザーが見つかりません'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {allUsers.map((user) => (
        <Link
          key={user.id}
          href={`/users/${user.id}`}
          className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-muted/50 transition-colors"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={48}
              height={48}
              sizes="48px"
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-lg">
                {user.nickname.charAt(0)}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user.nickname}</p>

            {user.bio && (
              <p className="text-sm text-muted-foreground line-clamp-1">{user.bio}</p>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              {user.followersCount}フォロワー
            </p>
          </div>
        </Link>
      ))}

      <div ref={ref} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}

        {!hasNextPage && allUsers.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上ユーザーはいません</p>
        )}
      </div>
    </div>
  )
}
