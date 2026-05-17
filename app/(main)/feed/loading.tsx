/**
 * @file タイムラインページ専用ローディングコンポーネント
 * @description タイムラインページのデータ取得中に表示されるスケルトンUI
 *
 * このファイルはNext.js App Routerの規約に基づくローディングUIです。
 * /feedページへのナビゲーション時やデータ取得中に自動的に表示されます。
 * 投稿フォームとタイムラインの両方のスケルトンを表示して、
 * ユーザーに読み込み中であることを視覚的に伝えます。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
 */

// タイムラインスケルトンコンポーネント
// 投稿カードのプレースホルダーを表示
import { TimelineSkeleton } from '@/components/feed/TimelineSkeleton'

/**
 * タイムラインローディングコンポーネント
 *
 * タイムラインページ専用のローディング状態を表示します。
 * 以下の2つのセクションで構成されています:
 *
 * 1. 投稿フォームスケルトン - テキストエリアとボタンのプレースホルダー
 * 2. タイムラインスケルトン - 投稿カード一覧のプレースホルダー
 *
 * animate-pulseクラスにより、要素が点滅してローディング中であることを示します。
 *
 * @returns スケルトンUIのJSX要素
 */
export default function FeedLoading() {
  return (
    <div className="space-y-6">
      {/* 投稿フォームスケルトン
          実際の投稿フォームと同じレイアウトを模したプレースホルダー */}
      <div className="bg-card rounded-lg border p-4">
        <div className="animate-pulse space-y-3">
          {/* テキストエリアのプレースホルダー */}
          <div className="h-24 bg-muted rounded-lg" />
          {/* ボタン類のプレースホルダー（メディア追加、ジャンル選択、投稿ボタン） */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-muted rounded" />
              <div className="h-8 w-20 bg-muted rounded" />
            </div>
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* タイムラインスケルトン
          投稿一覧のプレースホルダー */}
      <div>
        {/* セクションタイトルのプレースホルダー */}
        <div className="h-6 w-32 bg-muted rounded mb-4 animate-pulse" />
        {/* TimelineSkeletonコンポーネントで複数の投稿カードスケルトンを表示 */}
        <TimelineSkeleton />
      </div>
    </div>
  )
}
