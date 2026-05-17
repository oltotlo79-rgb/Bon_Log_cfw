/**
 * @file 管理者用モデレーションキューページのローディング画面
 * @description モデレーションキューの読み込み中に表示されるローディング画面。
 *              Next.jsのSuspense機能と連携して自動的に表示される。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * モデレーションキューページのローディングコンポーネント
 * データ取得中に自動的に表示され、読み込み完了後は実際のページに置き換わる
 *
 * @returns ローディング画面のJSX要素
 */
export default function AdminModerationQueueLoading() {
  return <LoadingScreen message="モデレーションキューを読み込んでいます..." />
}
