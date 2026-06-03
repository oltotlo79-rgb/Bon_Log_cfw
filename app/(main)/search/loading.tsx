/**
 * 検索ページのローディングスケルトン
 *
 *
 * @returns ローディングスケルトンのJSX
 */
export default function SearchLoading() {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4">
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="flex border-b">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 py-3 flex justify-center">
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
