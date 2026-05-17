/**
 * @file 管理者ロール管理ページのローディング画面
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function RolesLoading() {
  return <LoadingScreen message="管理者ロール情報を読み込んでいます..." />
}
