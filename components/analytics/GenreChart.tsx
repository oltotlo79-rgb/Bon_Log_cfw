type GenreData = {
  name: string
  postCount: number
  avgLikes: number
  avgComments: number
  avgEngagement: number
}

type GenreChartProps = {
  genres: GenreData[]
}

export function GenreChart({ genres }: GenreChartProps) {
  if (genres.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        ジャンルデータがありません
      </div>
    )
  }

  const maxEngagement = Math.max(...genres.map(g => g.avgEngagement), 1)

  return (
    <div className="space-y-3">
      {genres.map((genre) => {
        const barWidth = (genre.avgEngagement / maxEngagement) * 100
        return (
          <div key={genre.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{genre.name}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 ml-2">
                <span>{genre.postCount}投稿</span>
                <span className="font-medium text-foreground">
                  avg {genre.avgEngagement}
                </span>
              </div>
            </div>
            <div className="h-6 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full flex items-center relative" style={{ width: `${Math.max(barWidth, 2)}%` }}>
                <div
                  className="absolute inset-0 bg-primary/60 rounded-full"
                  style={{ width: `${genre.avgEngagement > 0 ? (genre.avgLikes / genre.avgEngagement) * 100 : 50}%` }}
                  title={`平均いいね: ${genre.avgLikes}`}
                />
                <div
                  className="absolute inset-0 bg-primary/30 rounded-full"
                  title={`平均コメント: ${genre.avgComments}`}
                />
                <div
                  className="absolute inset-0 bg-primary/60 rounded-l-full"
                  style={{ width: `${genre.avgEngagement > 0 ? (genre.avgLikes / genre.avgEngagement) * 100 : 50}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/60" />
          いいね
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/30" />
          コメント
        </span>
      </div>
    </div>
  )
}
