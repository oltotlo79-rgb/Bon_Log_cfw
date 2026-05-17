/**
 * @file メインレイアウト共通ローディングコンポーネント
 * @description (main)ルートグループ全体のローディング状態を表示
 *
 * このファイルはNext.js App Routerの規約に基づくローディングUIです。
 * (main)配下のページがデータ取得中の際に自動的に表示されます。
 * React Suspenseと連携して、ストリーミングSSRを実現します。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
 */

// 共通ローディングスクリーンコンポーネント
// アプリケーション全体で統一されたローディング表示を提供
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * メインローディングコンポーネント
 *
 * (main)ルートグループ配下のページ遷移時に表示されるローディング画面です。
 * 共通のLoadingScreenコンポーネントを使用して、
 * アプリケーション全体で一貫したローディング体験を提供します。
 *
 * @returns ローディングスクリーンコンポーネント
 */
export default function MainLoading() {
  return <LoadingScreen />
}
