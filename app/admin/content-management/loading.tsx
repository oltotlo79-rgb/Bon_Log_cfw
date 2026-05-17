/**
 * @file CMS管理ページのローディング画面
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function ContentManagementLoading() {
  return <LoadingScreen message="コンテンツ管理を読み込んでいます..." />
}
