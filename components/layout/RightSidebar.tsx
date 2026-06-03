import Link from 'next/link'
import Image from 'next/image'
import { getRecommendedUsers, getTrendingGenres } from '@/lib/actions/feed'
import {
  ROUTE_ABOUT,
  ROUTE_CONTACT,
  ROUTE_HELP,
  ROUTE_PRIVACY,
  ROUTE_SEARCH,
  ROUTE_TERMS,
  ROUTE_TOKUSHOHO,
} from '@/lib/constants/routes'
import { buildSearchByGenrePath, buildUserPath } from '@/lib/constants/path-builders'
import { SidebarAdUnit } from '@/components/ads'
import { SeasonalBanner } from '@/components/common/SeasonalBanner'

function TrendingIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

export async function RightSidebar() {
  const [usersResult, genresResult] = await Promise.all([
    getRecommendedUsers(5),
    getTrendingGenres(5),
  ])

  const recommendedUsers = usersResult.users || []
  const trendingGenres = genresResult.genres || []

  return (
    <aside className="sticky top-0 h-screen w-[360px] border-l border-border/30 bg-gradient-to-b from-card via-card to-muted/20 hidden xl:flex flex-col p-5 overflow-y-auto">
      <div className="card-washi bg-card p-4 mb-6 transition-all duration-300">

        <h3 className="font-medium mb-4 text-[13px] flex items-center gap-2.5 tracking-wide">
          <span className="w-[3px] h-4 bg-primary rounded-full" />
          おすすめユーザー
        </h3>

        {recommendedUsers.length > 0 ? (
          <ul className="space-y-1">
            {recommendedUsers.map((user: typeof recommendedUsers[number]) => (
              <li key={user.id}>
                <Link
                  href={buildUserPath(user.id)}
                  className="flex items-center gap-3 hover:bg-muted/40 rounded-md p-2 -mx-1 transition-all duration-200 group"
                >
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.nickname}
                      width={38}
                      height={38}
                      className="rounded-full object-cover ring-1 ring-border/60 transition-shadow duration-200 group-hover:ring-primary/30"
                    />
                  ) : (
                    <div className="w-[38px] h-[38px] rounded-full bg-muted/60 flex items-center justify-center ring-1 ring-border/60 transition-shadow duration-200 group-hover:ring-primary/30">
                      <span className="text-muted-foreground text-sm font-medium">
                        {user.nickname.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[13px] truncate group-hover:text-primary transition-colors">{user.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.followersCount}フォロワー
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            おすすめユーザーはいません
          </p>
        )}

        <Link
          href={`${ROUTE_SEARCH}?tab=users`}
          className="inline-flex items-center text-[13px] text-primary/80 hover:text-primary mt-4 transition-colors tracking-wide group"
        >
          もっと見る
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 ml-1 transition-transform duration-200 group-hover:translate-x-0.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>

      <div className="card-washi bg-card p-4 mb-6 transition-all duration-300">

        <h3 className="font-medium mb-4 text-[13px] flex items-center gap-2.5 tracking-wide">
          <TrendingIcon className="w-4 h-4 text-accent" />
          トレンドジャンル
        </h3>

        {trendingGenres.length > 0 ? (
          <ul className="space-y-0.5">
            {trendingGenres.map((genre: typeof trendingGenres[number], index: number) => (
              <li key={genre.id}>
                <Link
                  href={buildSearchByGenrePath(genre.id)}
                  className="flex items-center gap-3 hover:bg-muted/40 rounded-md p-2 -mx-1 transition-all duration-200 group"
                >
                  <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-medium ${index === 0
                    ? 'bg-primary/15 text-primary'
                    : index === 1
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-[13px] group-hover:text-primary transition-colors">{genre.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {genre.postCount}件の投稿
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            トレンドデータはありません
          </p>
        )}
      </div>

      <div className="mb-6">
        <SeasonalBanner />
      </div>

      <div className="mt-4">
        <SidebarAdUnit />
      </div>

      <div className="mt-auto pt-6 text-xs text-muted-foreground/70">
        <div className="brush-divider opacity-50 mb-4" />

        <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 leading-relaxed">
          <Link href={ROUTE_ABOUT} className="hover:text-primary/80 transition-colors">BON-LOGについて</Link>
          <span className="text-border/60">·</span>
          <Link href={ROUTE_TERMS} className="hover:text-primary/80 transition-colors">利用規約</Link>
          <span className="text-border/60">·</span>
          <Link href={ROUTE_PRIVACY} className="hover:text-primary/80 transition-colors">プライバシー</Link>
          <span className="text-border/60">·</span>
          <Link href={ROUTE_TOKUSHOHO} className="hover:text-primary/80 transition-colors">特商法表記</Link>
          <span className="text-border/60">·</span>
          <Link href={ROUTE_HELP} className="hover:text-primary/80 transition-colors">ヘルプ</Link>
          <span className="text-border/60">·</span>
          <Link href={ROUTE_CONTACT} className="hover:text-primary/80 transition-colors">お問い合わせ</Link>
        </div>

        <p className="mt-3 text-muted-foreground/50">&copy; 2024 BON-LOG</p>
      </div>
    </aside>
  )
}
