/**
 * @file 管理者用イベント管理ページのローディング画面
 * @description イベント一覧のデータ取得中に表示されるローディング画面。
 *              Next.jsのApp Routerのloading.tsxファイルとして機能。
 */

// 共通のローディング画面コンポーネント
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * イベント管理ページローディングコンポーネント
 * イベントデータの読み込み中にスピナーとメッセージを表示する
 *
 * @returns ローディング画面のJSX要素
 *
 * Next.jsのApp Router仕様:
 * - loading.tsxはpage.tsxと同じディレクトリに配置することで自動的にSuspenseフォールバックとして機能
 * - ページコンポーネントのデータ取得中の間、この画面が表示される
 */
export default function AdminEventsLoading() {
  return <LoadingScreen message="イベント一覧を読み込んでいます..." />
}
