/**
 * 通知ページのローディングスケルトン
 *
 *
 * @returns ローディングスケルトンのJSX
 */
export default function NotificationsLoading() {
  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="p-4 border-b">
        <div className="h-7 w-20 bg-muted rounded animate-pulse" />
      </div>

      <div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 p-4 border-b animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted" />

            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
