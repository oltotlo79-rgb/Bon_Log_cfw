/**
 * @file IPアドレス管理ページローディング画面
 * @description IPアドレス管理ページのデータ取得中に表示されるローディング画面。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function IpManagementLoading() {
  return <LoadingScreen message="IPアドレス情報を読み込んでいます..." />
}
