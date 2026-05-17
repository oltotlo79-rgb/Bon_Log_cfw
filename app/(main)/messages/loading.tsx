/**
 * @fileoverview メッセージ一覧ページのローディング画面
 *
 * このファイルはNext.js App Routerの規約に従ったローディングUIコンポーネントです。
 * /messagesページでデータ取得中に自動的に表示されます。
 *
 * 主な機能:
 * - メッセージ一覧読み込み中のフォールバックUI表示
 * - React Suspenseと連携した自動的なローディング状態管理
 * - ユーザーへの視覚的フィードバック提供
 *
 * @route /messages
 */

// 共通ローディング画面コンポーネント（スピナーとメッセージを表示）
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * メッセージ一覧ページのローディングコンポーネント
 *
 * Server/Client Componentのどちらでも動作します。
 * Next.jsがSuspenseバウンダリとして自動的にラップし、
 * ページコンポーネントのデータ取得が完了するまでこのコンポーネントを表示します。
 *
 * @returns {JSX.Element} ローディング画面のJSX要素
 */
export default function MessagesLoading() {
  return <LoadingScreen message="メッセージを読み込んでいます..." />
}
