/**
 * 盆栽詳細スケルトンコンポーネント
 *
 * 盆栽情報カードと成長記録タイムラインのスケルトンを表示します。
 *
 * @returns スケルトンUIのJSX要素
 */
export default function BonsaiDetailLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="h-5 bg-muted rounded w-32" />
          <div className="h-8 bg-muted rounded w-8" />
        </div>

        <div className="aspect-square bg-muted" />

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="h-7 bg-muted rounded w-48" />
            <div className="h-5 bg-muted rounded w-32" />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-36" />
          </div>

          <div className="space-y-2 pt-2">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-4/5" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-muted rounded w-28" />
          <div className="h-9 bg-muted rounded w-32" />
        </div>
      </div>

      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <div className="h-6 bg-muted rounded w-24" />
        </div>

        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 text-center">
                  <div className="h-3 bg-muted rounded w-8 mb-1" />
                  <div className="h-8 bg-muted rounded w-10" />
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex gap-2">
                    <div className="w-20 h-20 bg-muted rounded" />
                    <div className="w-20 h-20 bg-muted rounded" />
                  </div>

                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>

                  <div className="flex gap-2">
                    <div className="h-5 bg-muted rounded-full w-14" />
                    <div className="h-5 bg-muted rounded-full w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
