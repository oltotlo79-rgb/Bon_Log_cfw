/**
 * @file 盆栽園マップページのローディングUI
 * @description 盆栽園マップページのデータ取得中に表示されるスケルトンUI。
 * Next.js App Routerの規約により、page.tsxのサーバーコンポーネントが
 * データを取得している間、自動的にこのコンポーネントが表示される。
 * Suspenseフォールバックとして機能し、ユーザー体験を向上させる。
 */

/**
 * 盆栽園マップのローディングスケルトンコンポーネント
 *
 * 実際のページレイアウトと同じ構造を持つスケルトンUIを提供し、
 * コンテンツの読み込み中もレイアウトシフトを防ぐ。
 * animate-pulseクラスでパルスアニメーションを適用している。
 */
export default function ShopsLoading() {
  return (
    <div className="space-y-6">
      {/* ヘッダースケルトン: タイトルと新規登録ボタンのプレースホルダー */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-10 w-36 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* マップスケルトン: Leaflet地図のプレースホルダー */}
      <div className="h-[500px] w-full bg-muted rounded-lg animate-pulse" />

      {/* 検索フォームスケルトン: 検索入力とフィルターのプレースホルダー */}
      <div className="bg-card rounded-lg border p-4 space-y-4">
        {/* 検索入力フィールド */}
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        {/* ジャンル・ソートフィルター */}
        <div className="flex gap-4">
          <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>

      {/* リストスケルトン: 盆栽園カードのプレースホルダー */}
      <div>
        {/* セクションタイトル */}
        <div className="h-7 w-40 bg-muted rounded mb-4 animate-pulse" />
        {/* 盆栽園カードグリッド */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {/* 4枚のスケルトンカードを表示 */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg border p-4 space-y-3 animate-pulse">
              {/* 盆栽園名 */}
              <div className="h-6 w-3/4 bg-muted rounded" />
              {/* 住所 */}
              <div className="h-4 w-full bg-muted rounded" />
              {/* 追加情報 */}
              <div className="h-4 w-1/2 bg-muted rounded" />
              {/* ジャンルタグ */}
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-muted rounded-full" />
                <div className="h-6 w-16 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
