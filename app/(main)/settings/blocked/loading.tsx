/**
 * @fileoverview ブロック中のユーザー一覧ページのローディング画面
 *
 * このファイルはNext.js App Routerの規約に従ったローディングUIコンポーネントです。
 * /settings/blockedページのデータ取得中に表示されるフォールバックUIを提供します。
 *
 * Next.jsの仕組み:
 * - loading.tsxファイルは自動的にSuspenseバウンダリとして機能します
 * - ページコンポーネント（page.tsx）のデータフェッチ中に自動表示されます
 * - ブロック中ユーザーのリスト取得完了後は自動的にページコンテンツに切り替わります
 *
 * なぜ必要か:
 * - ユーザーにブロックリスト読み込み中であることを伝える（UX向上）
 * - データベースからのユーザー情報取得に時間がかかる場合の待機状態を表現
 * - ページ遷移がスムーズに見えるようにする
 *
 * @route /settings/blocked
 * @requires Server Component - Next.jsが自動的にSuspenseでラップ
 */

// 共通のローディング画面コンポーネント（スピナー + メッセージ表示）
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * ブロック中ユーザー一覧ページのローディングコンポーネント
 *
 * ブロック中のユーザーリスト取得中に表示されるローディングUIです。
 * LoadingScreenコンポーネントを使用して統一されたローディング体験を提供します。
 *
 * @returns {JSX.Element} ローディング画面のJSX要素
 */
export default function SettingsBlockedLoading() {
  // LoadingScreenコンポーネントにメッセージを渡してローディング画面を表示
  // messageプロパティはローディングスピナーの下に表示されるテキスト
  return <LoadingScreen message="ブロックリストを読み込んでいます..." />
}
