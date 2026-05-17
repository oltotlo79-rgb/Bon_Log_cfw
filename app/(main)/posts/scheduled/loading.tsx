/**
 * @file 予約投稿一覧ページ専用ローディングコンポーネント
 * @description 予約投稿一覧ページのデータ取得中に表示されるローディングUI
 *
 * このファイルはNext.js App Routerの規約に基づくローディングUIです。
 * /posts/scheduledページへのナビゲーション時やデータ取得中に自動的に表示されます。
 * LoadingScreenコンポーネントを使用して、統一されたローディング体験を提供します。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
 */

// 共通ローディングスクリーンコンポーネント
// アプリケーション全体で統一されたローディング表示を提供
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * 予約投稿一覧ローディングコンポーネント
 *
 * 予約投稿一覧ページ専用のローディング状態を表示します。
 * カスタムメッセージを渡すことで、ユーザーに現在の処理内容を伝えます。
 *
 * @returns ローディングスクリーンコンポーネント
 */
export default function ScheduledPostsLoading() {
  return <LoadingScreen message="予約投稿を読み込んでいます..." />
}
