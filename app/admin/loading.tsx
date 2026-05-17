/**
 * @file 管理者ページ共通ローディング画面
 * @description 管理者ページのデータ取得中に表示されるローディング画面。
 *              Next.jsのApp Routerのloading.tsxファイルとして機能し、
 *              Suspenseフォールバックとして自動的に表示される。
 */

// 共通のローディング画面コンポーネント
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * 管理者ページローディングコンポーネント
 * 管理者ページのデータ読み込み中にスピナーとメッセージを表示する
 *
 * @returns ローディング画面のJSX要素
 *
 * Next.jsのApp Router仕様:
 * - loading.tsxはpage.tsxと同じディレクトリに配置することで自動的にSuspenseフォールバックとして機能
 * - ページコンポーネントがServer Componentでデータ取得中の間、この画面が表示される
 * - データ取得完了後、自動的にページコンテンツに切り替わる
 */
export default function AdminLoading() {
  return <LoadingScreen message="管理画面を読み込んでいます..." />
}
