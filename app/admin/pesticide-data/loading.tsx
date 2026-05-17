/**
 * @file 農薬データ管理 ローディング画面
 * @description 農薬データ管理ページのデータ取得中に表示されるローディング画面。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function PesticideDataLoading() {
  return <LoadingScreen message="農薬データを読み込んでいます..." />
}
