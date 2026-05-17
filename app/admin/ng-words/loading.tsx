/**
 * @file NGワード管理ページのローディング画面
 * @description NGワード一覧の読み込み中に表示されるローディング画面。
 *              Next.jsのSuspense機能と連携して自動的に表示される。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * NGワード管理ページのローディングコンポーネント
 */
export default function NgWordsLoading() {
  return <LoadingScreen message="NGワード一覧を読み込んでいます..." />
}
