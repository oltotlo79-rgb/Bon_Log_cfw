/**
 * @file ブックマークページローディングコンポーネント
 * @description ブックマークページの読み込み中に表示されるローディング画面
 *              Next.js App Routerのloading.tsx規約に従い、
 *              ページ遷移時のローディング状態を自動的に表示
 */

// 共通のローディング画面コンポーネント - アプリ全体で統一されたローディングUIを提供
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * ブックマークページのローディング画面
 *
 * @description
 * ブックマークページへのナビゲーション時に自動的に表示される
 * LoadingScreenコンポーネントを使用して、統一されたローディング体験を提供
 * カスタムメッセージでユーザーに現在の状態を伝える
 *
 * @returns ローディング画面のJSX
 */
export default function BookmarksLoading() {
  return <LoadingScreen message="ブックマークを読み込んでいます..." />
}
