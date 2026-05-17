/**
 * @file バックアップ管理 ローディング画面
 * @description バックアップ管理ページのデータ取得中に表示されるローディング画面。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function BackupsLoading() {
  return <LoadingScreen message="バックアップ情報を読み込んでいます..." />
}
