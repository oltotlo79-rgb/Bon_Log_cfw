/**
 * @file 投稿詳細ページ専用ローディングコンポーネント
 * @description 投稿詳細ページのデータ取得中に表示されるスケルトンUI
 *
 * このファイルはNext.js App Routerの規約に基づくローディングUIです。
 * /posts/[id]ページへのナビゲーション時やデータ取得中に自動的に表示されます。
 *
 * 実際のページレイアウトを模したスケルトンを表示することで、
 * 読み込み完了時のレイアウトシフトを最小限に抑えます。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
 */

/**
 * 投稿詳細ローディングコンポーネント
 *
 * 投稿詳細ページ専用のローディング状態を表示します。
 * 実際のページと同じレイアウトを模したスケルトンUIを提供します。
 *
 * 構成:
 * - 戻るリンクのプレースホルダー
 * - 投稿カード（アバター、ユーザー名、本文、メディア、アクションボタン）
 * - シェアボタンセクション
 * - 広告エリア
 * - コメントセクション（投稿フォーム、コメント一覧）
 *
 * animate-pulseクラスにより、要素が点滅してローディング中であることを示します。
 *
 * @returns スケルトンUIのJSX要素
 */
export default function PostLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* 投稿カードのスケルトン */}
      <div className="bg-card rounded-lg border overflow-hidden animate-pulse">
        {/* 戻るリンクのプレースホルダー */}
        <div className="px-4 py-3 border-b">
          <div className="h-4 bg-muted rounded w-36" />
        </div>

        {/* 投稿本体のスケルトン */}
        <div className="p-4">
          <div className="flex gap-3">
            {/* アバター画像のプレースホルダー（円形） */}
            <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />

            {/* コンテンツエリアのプレースホルダー */}
            <div className="flex-1 space-y-3">
              {/* ユーザー名と投稿日時 */}
              <div className="flex items-center gap-2">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>

              {/* 投稿本文 */}
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>

              {/* メディアプレースホルダー（画像/動画） */}
              <div className="aspect-video bg-muted rounded-lg" />

              {/* アクションボタン（いいね、コメント、ブックマーク等） */}
              <div className="flex items-center gap-6 pt-2">
                <div className="h-5 bg-muted rounded w-12" />
                <div className="h-5 bg-muted rounded w-12" />
                <div className="h-5 bg-muted rounded w-12" />
                <div className="h-5 bg-muted rounded w-8" />
              </div>
            </div>
          </div>
        </div>

        {/* シェアボタンセクションのスケルトン */}
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-muted rounded-full" />
            <div className="h-8 w-8 bg-muted rounded-full" />
            <div className="h-8 w-8 bg-muted rounded-full" />
            <div className="h-8 w-8 bg-muted rounded-full" />
          </div>
        </div>

        {/* 広告エリアのスケルトン */}
        <div className="border-t p-4 flex justify-center">
          <div className="h-24 bg-muted rounded w-full max-w-md" />
        </div>

        {/* コメントセクションのスケルトン */}
        <div className="border-t p-4 space-y-4">
          {/* コメント投稿フォーム */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1">
              <div className="h-20 bg-muted rounded" />
            </div>
          </div>

          {/* コメント数表示 */}
          <div className="h-5 bg-muted rounded w-20" />

          {/* コメント一覧のスケルトン */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 bg-muted rounded w-20" />
                    <div className="h-3 bg-muted rounded w-12" />
                  </div>
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  {/* 返信ボタン等 */}
                  <div className="flex gap-4 pt-1">
                    <div className="h-4 bg-muted rounded w-10" />
                    <div className="h-4 bg-muted rounded w-10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
