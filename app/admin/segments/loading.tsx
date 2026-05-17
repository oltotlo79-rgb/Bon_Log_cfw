/**
 * @file セグメント管理ページローディング画面
 * @description セグメント管理ページのデータ取得中に表示されるローディング画面。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

export default function SegmentsLoading() {
  return <LoadingScreen message="セグメント情報を読み込んでいます..." />
}
