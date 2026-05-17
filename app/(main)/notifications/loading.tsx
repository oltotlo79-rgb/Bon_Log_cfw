/**
 * @file 通知ページローディングコンポーネント
 * @description 通知ページの読み込み中に表示されるスケルトンUI
 *              Next.js App Routerのloading.tsx規約に従い、
 *              ページ遷移時のローディング状態を自動的に表示
 */

/**
 * 通知ページのローディングスケルトン
 *
 * @description
 * 通知ページへのナビゲーション時に自動的に表示される
 * 実際の通知アイテムのレイアウトを模したスケルトンUIで、
 * ユーザーにスムーズな体験を提供
 *
 * @returns ローディングスケルトンのJSX
 */
export default function NotificationsLoading() {
  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* ページヘッダースケルトン */}
      <div className="p-4 border-b">
        {/* 「通知」タイトルのプレースホルダー */}
        <div className="h-7 w-20 bg-muted rounded animate-pulse" />
      </div>

      {/* 通知リストスケルトン */}
      <div>
        {/* 5件の通知アイテムスケルトンを表示 */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 p-4 border-b animate-pulse">
            {/* アバタースケルトン（円形） */}
            <div className="w-10 h-10 rounded-full bg-muted" />

            {/* 通知コンテンツ部分のスケルトン */}
            <div className="flex-1 space-y-2">
              {/* 通知メッセージスケルトン（例：「〇〇さんがいいねしました」） */}
              <div className="h-4 w-3/4 bg-muted rounded" />
              {/* 通知日時スケルトン */}
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
