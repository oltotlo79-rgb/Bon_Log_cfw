/**
 * @file EventFilterPersistence.tsx
 * @description イベントフィルター永続化コンポーネント
 *
 * 目的:
 * - ユーザーのフィルター設定をlocalStorageに保存し、次回訪問時に復元する
 * - ページリロードやブラウザ再起動後もフィルター状態を維持する
 * - ユーザー体験の向上（毎回同じフィルターを設定する手間を省く）
 *
 * 機能概要:
 * - URLクエリパラメータの変更を監視してlocalStorageに保存
 * - 初回アクセス時（URLパラメータなし）にlocalStorageから設定を復元
 * - 地方、都道府県、表示形式、終了イベント表示の4種類の設定を永続化
 * - UIを持たないユーティリティコンポーネント（nullを返す）
 *
 * 使用例:
 * ```tsx
 * // イベント一覧ページのレイアウトに配置
 * export default function EventsLayout({ children }) {
 *   return (
 *     <>
 *       <EventFilterPersistence />
 *       {children}
 *     </>
 *   );
 * }
 * ```
 *
 * 保存される設定:
 * - region: 地方ブロック（北海道、東北、関東など）
 * - prefecture: 都道府県
 * - view: 表示形式（list、calendar）
 * - showPast: 終了イベントの表示有無
 */

// Client Componentとして宣言（useEffect, localStorage等のブラウザAPIを使用するため）
'use client'

// React Hooks - 副作用処理に使用
import { useEffect } from 'react'

// Next.jsのルーターとURLパラメータ取得フック
import { useRouter, useSearchParams } from 'next/navigation'

import { STORAGE_KEY_EVENT_FILTER } from '@/lib/constants/storage-keys'

/**
 * フィルター設定の型定義
 * localStorageに保存/復元される設定の構造
 */
interface FilterSettings {
  /** 地方ブロック（例: "関東"、"関西"） */
  region?: string
  /** 都道府県（例: "東京都"、"大阪府"） */
  prefecture?: string
  /** 表示形式（"list" または "calendar"） */
  view?: string
  /** 終了イベントを表示するかどうか（"true" または undefined） */
  showPast?: string
}

/**
 * イベントフィルター永続化コンポーネント
 * フィルター設定のlocalStorage保存と復元を自動的に行う
 *
 * このコンポーネントはUIを持たず、副作用のみを実行する
 *
 * @returns null（UIなし）
 */
export function EventFilterPersistence() {
  // プログラムによるページ遷移に使用
  const router = useRouter()

  // 現在のURLクエリパラメータを取得
  const searchParams = useSearchParams()

  // ------------------------------------------------------------
  // Effect 1: URLパラメータの変更を監視してlocalStorageに保存
  // ------------------------------------------------------------
  /**
   * URLパラメータが変更されるたびにlocalStorageに保存する
   * これにより、ユーザーがフィルターを変更するたびに自動保存される
   */
  useEffect(() => {
    // 現在のフィルター設定を収集
    const currentSettings: FilterSettings = {}

    // URLから各パラメータを取得
    const region = searchParams.get('region')
    const prefecture = searchParams.get('prefecture')
    const view = searchParams.get('view')
    const showPast = searchParams.get('showPast')

    // 値がある場合のみ設定オブジェクトに追加
    if (region) currentSettings.region = region
    if (prefecture) currentSettings.prefecture = prefecture
    if (view) currentSettings.view = view
    if (showPast) currentSettings.showPast = showPast

    // URLにパラメータがある場合はlocalStorageに保存
    // パラメータが1つもない場合は保存しない（クリア操作との区別）
    if (Object.keys(currentSettings).length > 0) {
      localStorage.setItem(STORAGE_KEY_EVENT_FILTER, JSON.stringify(currentSettings))
    }
  }, [searchParams]) // searchParamsが変更されるたびに実行

  // ------------------------------------------------------------
  // Effect 2: 初回アクセス時にlocalStorageから設定を復元
  // ------------------------------------------------------------
  /**
   * コンポーネントマウント時（初回のみ）に実行
   * URLにパラメータがない場合、保存された設定を復元する
   */
  useEffect(() => {
    // URLにパラメータがあるかどうかをチェック
    const hasParams = searchParams.toString().length > 0

    // URLにパラメータがなく、localStorageに保存された設定がある場合のみ復元
    if (!hasParams) {
      try {
        // localStorageから設定を取得
        const saved = localStorage.getItem(STORAGE_KEY_EVENT_FILTER)
        if (saved) {
          // JSONをパースして設定オブジェクトに変換
          const settings: FilterSettings = JSON.parse(saved)
          // URLパラメータを構築
          const params = new URLSearchParams()

          // 各設定をパラメータに追加
          if (settings.region) params.set('region', settings.region)
          if (settings.prefecture) params.set('prefecture', settings.prefecture)
          if (settings.view) params.set('view', settings.view)
          if (settings.showPast) params.set('showPast', settings.showPast)

          // パラメータがある場合はURLを置換（履歴に残さない）
          if (params.toString()) {
            router.replace(`/events?${params.toString()}`)
          }
        }
      } catch {
        // localStorageのエラー（プライベートモード等）は無視
        // ユーザー体験に影響を与えないようサイレントに処理
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // 注意: routerとsearchParamsを依存配列に含めると無限ループになるため意図的に除外

  // このコンポーネントはUIを持たない
  return null
}
