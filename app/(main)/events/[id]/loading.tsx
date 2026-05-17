/**
 * @file イベント詳細ページのスケルトンローディング
 * @description イベント詳細ページのデータ取得中に表示されるスケルトンUI。
 * 実際のレイアウトを模した形でプレースホルダーを表示し、
 * 読み込み完了時のレイアウトシフトを最小限に抑えます。
 */

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
      {/* 戻るリンクのスケルトン */}
      <div className="h-5 bg-muted rounded w-36" />

      {/* イベント情報カードのスケルトン */}
      <div className="bg-card rounded-lg border">
        <div className="p-6">
          {/* ヘッダー（タイトル、バッジ、アクションボタン） */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="space-y-2 flex-1">
              {/* ステータスバッジ */}
              <div className="flex items-center gap-2">
                <div className="h-5 bg-muted rounded-full w-16" />
                <div className="h-5 bg-muted rounded-full w-20" />
              </div>
              {/* イベントタイトル */}
              <div className="h-8 bg-muted rounded w-72" />
            </div>
            {/* アクションボタン */}
            <div className="flex items-center gap-2">
              <div className="h-9 bg-muted rounded w-20" />
              <div className="h-9 bg-muted rounded w-20" />
            </div>
          </div>

          {/* 詳細情報リスト */}
          <div className="space-y-4">
            {/* 開催日時 */}
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="h-5 bg-muted rounded w-48" />
                <div className="h-4 bg-muted rounded w-44" />
              </div>
            </div>

            {/* 開催場所 */}
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="h-5 bg-muted rounded w-32" />
                <div className="h-4 bg-muted rounded w-40" />
              </div>
            </div>

            {/* 主催者 */}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
              <div className="h-5 bg-muted rounded w-36" />
            </div>

            {/* 入場料 */}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
              <div className="h-5 bg-muted rounded w-28" />
            </div>

            {/* 外部リンク */}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-muted rounded flex-shrink-0" />
              <div className="h-5 bg-muted rounded w-56" />
            </div>
          </div>

          {/* 詳細説明セクション */}
          <div className="mt-6 pt-6 border-t">
            <div className="h-5 bg-muted rounded w-16 mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-4/5" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </div>

          {/* 登録者情報 */}
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
