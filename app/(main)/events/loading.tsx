/**
 * @file イベントページのローディングUI
 * @description イベント一覧ページのデータ取得中に表示されるスケルトンUI。
 * Next.js App Routerの規約により、page.tsxのサーバーコンポーネントが
 * データを取得している間、自動的にこのコンポーネントが表示される。
 * Suspenseフォールバックとして機能し、ユーザー体験を向上させる。
 */

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
      {/* ヘッダースケルトン: タイトルと新規登録ボタンのプレースホルダー */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-10 w-40 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* 地域フィルタースケルトン: 地方ブロック選択のプレースホルダー */}
      <div className="bg-card rounded-lg border p-4 space-y-4">
        {/* フィルターラベル */}
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        {/* 地方ブロックボタン群 */}
        <div className="flex flex-wrap gap-2">
          {/* 8つの地方ブロックボタンのスケルトン */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
          ))}
        </div>
      </div>

      {/* 表示切り替えスケルトン: カレンダー/リスト切り替えと過去イベントトグル */}
      <div className="flex items-center justify-between">
        {/* 表示モードボタン */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded-lg animate-pulse" />
        </div>
        {/* 過去イベントトグル */}
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      </div>

      {/* カレンダースケルトン: 月間カレンダーのプレースホルダー */}
      <div className="bg-card rounded-lg border">
        {/* カレンダーヘッダー: 前月/次月ボタンと月表示 */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        </div>

        {/* 曜日ヘッダー行 */}
        <div className="grid grid-cols-7 border-b">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-8 bg-muted/30 animate-pulse" />
          ))}
        </div>

        {/* カレンダーセル: 5週分（35日分）のグリッド */}
        <div className="grid grid-cols-7">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-24 border-b border-r bg-muted/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
