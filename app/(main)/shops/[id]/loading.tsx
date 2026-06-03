/**
 * 盆栽園詳細ページのスケルトンコンポーネント
 *
 * 盆栽園情報、地図エリア、レビューセクションのスケルトンを表示します。
 *
 * @returns スケルトンUIのJSX要素
 */
export default function ShopDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-5 bg-muted rounded w-40" />

      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-2 flex-1">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-5 h-5 bg-muted rounded" />
                ))}
              </div>
              <div className="h-4 bg-muted rounded w-24" />
            </div>
          </div>
          <div className="h-9 bg-muted rounded w-24" />
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-64" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-32" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-40" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-36" />
          </div>
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t">
          <div className="h-6 bg-muted rounded-full w-16" />
          <div className="h-6 bg-muted rounded-full w-20" />
          <div className="h-6 bg-muted rounded-full w-14" />
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="h-64 bg-muted" />
      </div>

      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <div className="h-6 bg-muted rounded w-20" />
        </div>

        <div className="p-4 border-b">
          <div className="space-y-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-8 h-8 bg-muted rounded" />
              ))}
            </div>
            <div className="h-24 bg-muted rounded" />
            <div className="h-9 bg-muted rounded w-24" />
          </div>
        </div>

        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 bg-muted rounded w-24" />
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <div key={j} className="w-4 h-4 bg-muted rounded" />
                      ))}
                    </div>
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
