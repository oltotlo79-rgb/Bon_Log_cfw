/**
 * @file コホート分析ページのローディング画面
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function CohortLoading() {
  return <LoadingScreen message="コホート分析を読み込んでいます..." />
}
