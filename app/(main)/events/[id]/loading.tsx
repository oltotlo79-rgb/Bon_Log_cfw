/**
 * イベント詳細ページのスケルトンコンポーネント
 *
 * イベント情報（タイトル、日時、場所、詳細）のスケルトンを表示します。
 *
 * @returns スケルトンUIのJSX要素
 */
export default function EventDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-5 bg-muted rounded w-36" />

      <div className="bg-card rounded-lg border">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-5 bg-muted rounded-full w-16" />
                <div className="h-5 bg-muted rounded-full w-20" />
              </div>
              <div className="h-8 bg-muted rounded w-72" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 bg-muted rounded w-20" />
              <div className="h-9 bg-muted rounded w-20" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="h-5 bg-muted rounded w-48" />
                <div className="h-4 bg-muted rounded w-44" />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="h-5 bg-muted rounded w-32" />
                <div className="h-4 bg-muted rounded w-40" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
              <div className="h-5 bg-muted rounded w-36" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
              <div className="h-5 bg-muted rounded w-28" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
              <div className="h-5 bg-muted rounded w-56" />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="h-5 bg-muted rounded w-16 mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-4/5" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2">
              <div className="h-4 bg-muted rounded w-16" />
              <div className="w-5 h-5 rounded-full bg-muted" />
              <div className="h-4 bg-muted rounded w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
