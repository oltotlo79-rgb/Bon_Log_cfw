/**
 * @file 下書き一覧ページのローディング画面
 * @description 下書き一覧データの取得中に表示されるローディング画面
 *              - Next.js App Routerのloading.tsxファイル規約に基づく実装
 *              - page.tsxがサーバーサイドでデータを取得している間、自動的にこのコンポーネントが表示される
 *              - Suspenseと連携して、ページ遷移時のユーザー体験を向上
 */

// 共通のローディング画面コンポーネント
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * 下書き一覧ローディングコンポーネント
 *
 * @description
 * - Next.jsが自動的に呼び出すローディング画面
 * - page.tsxのデータ取得（getDrafts）が完了するまで表示される
 * - ユーザーに処理中であることを視覚的にフィードバック
 *
 * @returns ローディング画面のJSX
 */
export default function DraftsLoading() {
  return <LoadingScreen message="下書きを読み込んでいます..." />
}
