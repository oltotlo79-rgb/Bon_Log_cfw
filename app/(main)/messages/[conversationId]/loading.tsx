/**
 * @fileoverview 会話詳細ページのローディング画面
 *
 * このファイルはNext.js App Routerの規約に従ったローディングUIコンポーネントです。
 * /messages/[conversationId]ページでデータ取得中に自動的に表示されます。
 *
 * 主な機能:
 * - 会話読み込み中のフォールバックUI表示
 * - React Suspenseと連携した自動的なローディング状態管理
 * - ユーザーへの視覚的フィードバック提供
 *
 * @route /messages/[conversationId]
 */

// 共通ローディング画面コンポーネント（スピナーとメッセージを表示）
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * 会話詳細ページのローディングコンポーネント
 *
 * Server/Client Componentのどちらでも動作します。
 * Next.jsがSuspenseバウンダリとして自動的にラップし、
 * ページコンポーネントのデータ取得が完了するまでこのコンポーネントを表示します。
 *
 * @returns {JSX.Element} ローディング画面のJSX要素
 */
export default function ConversationLoading() {
  return <LoadingScreen message="会話を読み込んでいます..." />
}
