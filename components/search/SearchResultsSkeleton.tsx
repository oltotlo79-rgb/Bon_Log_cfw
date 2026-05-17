/**
 * 検索結果スケルトンコンポーネント
 *
 * データ読み込み中に表示するプレースホルダー。
 * アニメーション付きのグレーブロックで構成。
 */
export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {/* 3件分のスケルトンカードを表示 */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
          {/* ユーザー情報部分のスケルトン */}
          <div className="flex items-center gap-3 mb-3">
            {/* アバター */}
            <div className="w-10 h-10 rounded-full bg-muted" />

            {/* ユーザー名・日時 */}
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>

          {/* コンテンツ部分のスケルトン */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
