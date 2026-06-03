/**
 * イベントページのローディングスケルトンコンポーネント
 *
 * 実際のページレイアウト（カレンダー表示時）と同じ構造を持つスケルトンUIを提供し、
 * コンテンツの読み込み中もレイアウトシフトを防ぐ。
 * animate-pulseクラスでパルスアニメーションを適用している。
 */
export default function EventsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-10 w-40 bg-muted rounded-lg animate-pulse" />
      </div>

      <div className="bg-card rounded-lg border p-4 space-y-4">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        <div className="flex flex-wrap gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      </div>

      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-7 border-b">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-8 bg-muted/30 animate-pulse" />
          ))}
        </div>

        <div className="grid grid-cols-7">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-24 border-b border-r bg-muted/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
