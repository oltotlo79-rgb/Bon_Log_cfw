/**
 * @file セキュリティダッシュボード ローディング画面
 * @description セキュリティダッシュボードページのデータ取得中に表示されるローディング画面。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function SecurityLoading() {
  return <LoadingScreen message="セキュリティ情報を読み込んでいます..." />
}
