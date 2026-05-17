/**
 * @fileoverview フォローリクエスト管理ページのローディング画面
 *
 * このファイルはNext.js App Routerの規約に従ったローディングUIコンポーネントです。
 * /settings/follow-requestsページのデータ取得中に表示されるフォールバックUIを提供します。
 *
 * Next.jsの仕組み:
 * - loading.tsxファイルは自動的にSuspenseバウンダリとして機能します
 * - ページコンポーネント（page.tsx）のデータフェッチ中に自動表示されます
 * - 受信・送信したフォローリクエストの取得完了後は自動的にページコンテンツに切り替わります
 *
 * なぜ必要か:
 * - ユーザーにフォローリクエスト読み込み中であることを伝える（UX向上）
 * - データベースから複数のリクエストデータを取得する際の待機状態を表現
 * - ページ遷移がスムーズに見えるようにする
 *
 * @route /settings/follow-requests
 * @requires Server Component - Next.jsが自動的にSuspenseでラップ
 */

// 共通のローディング画面コンポーネント（スピナー + メッセージ表示）
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * フォローリクエスト管理ページのローディングコンポーネント
 *
 * フォローリクエストデータの取得中に表示されるローディングUIです。
 * LoadingScreenコンポーネントを使用して統一されたローディング体験を提供します。
 *
 * @returns {JSX.Element} ローディング画面のJSX要素
 */
export default function SettingsFollowRequestsLoading() {
  // LoadingScreenコンポーネントにメッセージを渡してローディング画面を表示
  // messageプロパティはローディングスピナーの下に表示されるテキスト
  return <LoadingScreen message="フォローリクエストを読み込んでいます..." />
}
