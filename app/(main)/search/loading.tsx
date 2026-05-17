/**
 * @file 検索ページローディングコンポーネント
 * @description 検索ページの読み込み中に表示されるスケルトンUI
 *              Next.js App Routerのloading.tsx規約に従い、
 *              ページ遷移時のローディング状態を自動的に表示
 */

/**
 * 検索ページのローディングスケルトン
 *
 * @description
 * 検索ページへのナビゲーション時に自動的に表示される
 * 実際のページレイアウトを模したスケルトンUIで、
 * ユーザーにスムーズな体験を提供
 *
 * @returns ローディングスケルトンのJSX
 */
export default function SearchLoading() {
  return (
    <div className="space-y-4">
      {/* 検索バースケルトン - 検索入力欄のプレースホルダー */}
      <div className="bg-card rounded-lg border p-4">
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* タブと検索結果エリアのスケルトン */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* タブスケルトン - 3つのタブ（投稿/ユーザー/タグ）のプレースホルダー */}
        <div className="flex border-b">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 py-3 flex justify-center">
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* 検索結果スケルトン - 投稿カードのプレースホルダー */}
        <div className="p-4 space-y-4">
          {/* 3つの投稿カードスケルトンを表示 */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-4 animate-pulse">
              {/* ユーザー情報部分のスケルトン */}
              <div className="flex items-center gap-3 mb-3">
                {/* アバタースケルトン（円形） */}
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="space-y-2">
                  {/* ユーザー名スケルトン */}
                  <div className="h-4 w-24 bg-muted rounded" />
                  {/* 投稿日時スケルトン */}
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
              {/* 投稿本文部分のスケルトン（2行分） */}
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
