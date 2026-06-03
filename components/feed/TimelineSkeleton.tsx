/**
 * @module components/feed/TimelineSkeleton
 */

export function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
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

          <div className="h-48 w-full bg-muted rounded-lg" />

          <div className="flex gap-4 pt-2">
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PostSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
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
  )
}
