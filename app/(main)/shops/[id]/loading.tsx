/**
 * @file 盆栽園詳細ページのスケルトンローディング
 * @description 盆栽園詳細ページのデータ取得中に表示されるスケルトンUI。
 * 実際のレイアウトを模した形でプレースホルダーを表示し、
 * 読み込み完了時のレイアウトシフトを最小限に抑えます。
 */

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
      {/* 戻るリンクのスケルトン */}
      <div className="h-5 bg-muted rounded w-40" />

      {/* 盆栽園情報カードのスケルトン */}
      <div className="bg-card rounded-lg border p-6">
        {/* ヘッダー（タイトルと評価） */}
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

        {/* 詳細情報リスト */}
        <div className="space-y-3">
          {/* 住所 */}
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-64" />
          </div>
          {/* 電話番号 */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-32" />
          </div>
          {/* 営業時間 */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-40" />
          </div>
          {/* 定休日 */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
            <div className="h-5 bg-muted rounded w-36" />
          </div>
        </div>

        {/* ジャンルタグのスケルトン */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <div className="h-6 bg-muted rounded-full w-16" />
          <div className="h-6 bg-muted rounded-full w-20" />
          <div className="h-6 bg-muted rounded-full w-14" />
        </div>
      </div>

      {/* 地図エリアのスケルトン */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="h-64 bg-muted" />
      </div>

      {/* レビューセクションのスケルトン */}
      <div className="bg-card rounded-lg border">
        {/* セクションヘッダー */}
        <div className="p-4 border-b">
          <div className="h-6 bg-muted rounded w-20" />
        </div>

        {/* レビュー投稿フォームエリア */}
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

        {/* レビュー一覧のスケルトン */}
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
