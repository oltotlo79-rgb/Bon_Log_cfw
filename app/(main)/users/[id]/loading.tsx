/**
 * @module app/(main)/users/[id]/loading
 * プロフィールページのスケルトン。実コンテンツと同じレイアウトを維持して
 * 読み込み完了時のレイアウトシフトを最小化する。
 */
export default function UserLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-card rounded-lg border overflow-hidden animate-pulse">
        <div className="h-32 bg-muted" />

        <div className="px-4 pb-4">
          <div className="relative -mt-12 mb-4">
            <div className="w-24 h-24 rounded-full bg-muted border-4 border-card" />
          </div>

          <div className="space-y-3">
            <div className="h-6 bg-muted rounded w-40" />
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>

          <div className="flex gap-6 mt-4">
            <div className="space-y-1">
              <div className="h-5 bg-muted rounded w-8" />
              <div className="h-3 bg-muted rounded w-12" />
            </div>
            <div className="space-y-1">
              <div className="h-5 bg-muted rounded w-8" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
            <div className="space-y-1">
              <div className="h-5 bg-muted rounded w-8" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
          </div>

          <div className="mt-4">
            <div className="h-9 bg-muted rounded w-28" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden animate-pulse">
        <div className="flex border-b">
          <div className="flex-1 py-3 px-4">
            <div className="h-4 bg-muted rounded w-16 mx-auto" />
          </div>
          <div className="flex-1 py-3 px-4">
            <div className="h-4 bg-muted rounded w-20 mx-auto" />
          </div>
        </div>

        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 bg-muted rounded w-24" />
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-4/5" />
                  <div className="flex gap-4 mt-3">
                    <div className="h-4 bg-muted rounded w-12" />
                    <div className="h-4 bg-muted rounded w-12" />
                    <div className="h-4 bg-muted rounded w-12" />
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
