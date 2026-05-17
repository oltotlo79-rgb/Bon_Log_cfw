/**
 * @file RegionFilter.tsx
 * @description 地域フィルターコンポーネント
 *
 * 目的:
 * - イベントを地方ブロックまたは都道府県で絞り込む機能を提供する
 * - ユーザーが直感的に地域を選択できるUIを提供する
 * - URLクエリパラメータと連動したフィルタリングを実現する
 *
 * 機能概要:
 * - 地方ブロック（北海道、東北、関東など）によるフィルタリング
 * - 都道府県セレクトボックスによるフィルタリング
 * - 地方と都道府県は排他的（どちらか一方のみ選択可能）
 * - フィルター解除機能
 * - URLクエリパラメータへの反映
 *
 * 使用例:
 * ```tsx
 * <RegionFilter
 *   currentRegion="関東"
 *   currentPrefecture={undefined}
 * />
 *
 * // または都道府県で絞り込み中の場合
 * <RegionFilter
 *   currentRegion={undefined}
 *   currentPrefecture="東京都"
 * />
 * ```
 */

// Client Componentとして宣言（useRouter, useSearchParamsを使用するため）
'use client'

// Next.jsのルーターとURLパラメータ取得フック
import { useRouter, useSearchParams } from 'next/navigation'

// 地方ブロックと都道府県の定数データ
import { REGION_NAME_LIST as REGION_LIST, PREFECTURES } from '@/lib/prefectures'

/**
 * RegionFilterコンポーネントのプロパティ型定義
 */
interface RegionFilterProps {
  /** 現在選択されている地方ブロック（未選択の場合はundefined） */
  currentRegion?: string
  /** 現在選択されている都道府県（未選択の場合はundefined） */
  currentPrefecture?: string
}

/**
 * 地域フィルターコンポーネント
 * 地方ブロックまたは都道府県でイベントを絞り込むUIを提供する
 *
 * @param props - コンポーネントのプロパティ
 * @returns 地域フィルターのReact要素
 */
export function RegionFilter({ currentRegion, currentPrefecture }: RegionFilterProps) {
  // プログラムによるページ遷移に使用
  const router = useRouter()

  // 現在のURLクエリパラメータを取得
  const searchParams = useSearchParams()

  /**
   * 地方ブロック選択時のハンドラ
   * 選択した地方でフィルタリングし、都道府県フィルターは解除する
   *
   * @param region - 選択された地方ブロック名（空文字の場合は解除）
   */
  const handleRegionChange = (region: string) => {
    // 現在のパラメータをコピー
    const params = new URLSearchParams(searchParams.toString())
    if (region) {
      // 地方を設定し、都道府県は解除（排他的）
      params.set('region', region)
      params.delete('prefecture')
    } else {
      // 地方フィルターを解除
      params.delete('region')
    }
    // 新しいURLに遷移
    router.push(`/events?${params.toString()}`)
  }

  /**
   * 都道府県選択時のハンドラ
   * 選択した都道府県でフィルタリングし、地方フィルターは解除する
   *
   * @param prefecture - 選択された都道府県名（空文字の場合は解除）
   */
  const handlePrefectureChange = (prefecture: string) => {
    // 現在のパラメータをコピー
    const params = new URLSearchParams(searchParams.toString())
    if (prefecture) {
      // 都道府県を設定し、地方は解除（排他的）
      params.set('prefecture', prefecture)
      params.delete('region')
    } else {
      // 都道府県フィルターを解除
      params.delete('prefecture')
    }
    // 新しいURLに遷移
    router.push(`/events?${params.toString()}`)
  }

  /**
   * フィルタークリアハンドラ
   * 地方と都道府県の両方のフィルターを解除する
   */
  const handleClear = () => {
    // 現在のパラメータをコピー
    const params = new URLSearchParams(searchParams.toString())
    // 地域関連のパラメータを全て削除
    params.delete('region')
    params.delete('prefecture')
    // 新しいURLに遷移
    router.push(`/events?${params.toString()}`)
  }

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      {/* フィルターセクションのタイトル */}
      <h3 className="font-semibold">地域で絞り込み</h3>

      {/* 地方ブロック選択エリア */}
      <div>
        <label className="block text-sm text-muted-foreground mb-2">
          地方
        </label>
        {/* 地方ブロックをボタン形式で表示 */}
        <div className="flex flex-wrap gap-2">
          {REGION_LIST.map((region) => (
            <button
              key={region}
              // 同じ地方をクリックした場合は選択解除、それ以外は選択
              onClick={() => handleRegionChange(currentRegion === region ? '' : region)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                // 選択中の地方はプライマリカラーで強調表示
                currentRegion === region
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      {/* 都道府県選択エリア */}
      <div>
        <label htmlFor="prefecture-select" className="block text-sm text-muted-foreground mb-2">
          都道府県
        </label>
        <select
          id="prefecture-select"
          value={currentPrefecture || ''}
          onChange={(e) => handlePrefectureChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">すべての都道府県</option>
          {/* 都道府県リストをオプションとして展開 */}
          {PREFECTURES.map((pref) => (
            <option key={pref} value={pref}>
              {pref}
            </option>
          ))}
        </select>
      </div>

      {/* フィルタークリアボタン（フィルターが適用されている場合のみ表示） */}
      {(currentRegion || currentPrefecture) && (
        <button
          onClick={handleClear}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          フィルターをクリア
        </button>
      )}
    </div>
  )
}
