/**
 * @fileoverview プラン管理（サブスクリプション）ページのローディング画面
 *
 * このファイルはNext.js App Routerの規約に従ったローディングUIコンポーネントです。
 * /settings/subscriptionページのデータ取得中に表示されるフォールバックUIを提供します。
 *
 * Next.jsの仕組み:
 * - loading.tsxファイルは自動的にSuspenseバウンダリとして機能します
 * - ページコンポーネント（page.tsx）のデータフェッチ中に自動表示されます
 * - Stripeサブスクリプション情報と支払い履歴の取得完了後は自動的にページコンテンツに切り替わります
 *
 * なぜ必要か:
 * - ユーザーにサブスクリプション情報読み込み中であることを伝える（UX向上）
 * - データベースやStripe APIからの情報取得に時間がかかる場合の待機状態を表現
 * - ページ遷移がスムーズに見えるようにする
 *
 * @route /settings/subscription
 * @requires Server Component - Next.jsが自動的にSuspenseでラップ
 */

// 共通のローディング画面コンポーネント（スピナー + メッセージ表示）
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * プラン管理ページのローディングコンポーネント
 *
 * サブスクリプション情報と支払い履歴の取得中に表示されるローディングUIです。
 * LoadingScreenコンポーネントを使用して統一されたローディング体験を提供します。
 *
 * @returns {JSX.Element} ローディング画面のJSX要素
 */
export default function SettingsSubscriptionLoading() {
  // LoadingScreenコンポーネントにメッセージを渡してローディング画面を表示
  // messageプロパティはローディングスピナーの下に表示されるテキスト
  return <LoadingScreen message="サブスクリプション情報を読み込んでいます..." />
}
