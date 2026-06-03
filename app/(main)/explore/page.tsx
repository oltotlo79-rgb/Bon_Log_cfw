import Link from 'next/link'
import { Hash, TrendingUp, Users } from 'lucide-react'

import { getTrendingGenres, getRecommendedUsers } from '@/lib/actions/feed'
import { getTrendingHashtags } from '@/lib/actions/hashtag'
import { RecommendedUserList } from '@/components/user/RecommendedUserList'
import { buildSearchByGenrePath, buildSearchPath } from '@/lib/constants/path-builders'
import {
  EXPLORE_RECOMMENDED_USERS_LIMIT,
  EXPLORE_TRENDING_GENRES_LIMIT,
  EXPLORE_TRENDING_HASHTAGS_LIMIT,
} from '@/lib/constants/limits'

export const metadata = {
  title: '発見 | BON-LOG',
  // 認証必須のアプリ内ページのため検索インデックス対象外
  robots: { index: false, follow: false },
}

export default async function ExplorePage() {
  const [hashtags, genresResult, usersResult] = await Promise.all([
    getTrendingHashtags(EXPLORE_TRENDING_HASHTAGS_LIMIT),
    getTrendingGenres(EXPLORE_TRENDING_GENRES_LIMIT),
    getRecommendedUsers(EXPLORE_RECOMMENDED_USERS_LIMIT),
  ])

  const trendingGenres = genresResult.genres ?? []
  const recommendedUsers = usersResult.users ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4 px-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-primary" />
        発見
      </h1>

      <section className="bg-card rounded-lg border p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm">
          <Hash className="w-4 h-4 text-accent" />
          トレンドハッシュタグ
        </h2>
        {hashtags.length > 0 ? (
          <ul className="flex flex-wrap gap-2" data-testid="explore-hashtags">
            {hashtags.map((tag) => (
              <li key={tag.id}>
                <Link
                  href={buildSearchPath(`#${tag.name}`)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-sm transition-colors"
                >
                  <span className="text-primary">#</span>
                  {tag.name}
                  <span className="text-xs text-muted-foreground">{tag.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">トレンドデータはありません</p>
        )}
      </section>

      <section className="bg-card rounded-lg border p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-accent" />
          トレンドジャンル
        </h2>
        {trendingGenres.length > 0 ? (
          <ul className="space-y-1" data-testid="explore-genres">
            {trendingGenres.map((genre: typeof trendingGenres[number], index: number) => (
              <li key={genre.id}>
                <Link
                  href={buildSearchByGenrePath(genre.id)}
                  className="flex items-center gap-3 hover:bg-muted/40 rounded-md p-2 -mx-1 transition-colors group"
                >
                  <span className="w-6 h-6 rounded-full bg-muted text-xs flex items-center justify-center font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{genre.name}</p>
                    <p className="text-xs text-muted-foreground">{genre.postCount}件の投稿</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">トレンドデータはありません</p>
        )}
      </section>

      <section className="bg-card rounded-lg border p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-primary" />
          おすすめユーザー
        </h2>
        {recommendedUsers.length > 0 ? (
          <RecommendedUserList users={recommendedUsers} />
        ) : (
          <p className="text-sm text-muted-foreground">おすすめユーザーはいません</p>
        )}
      </section>
    </div>
  )
}
