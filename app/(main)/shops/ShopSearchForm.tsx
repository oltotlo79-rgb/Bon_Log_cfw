/**
 * @file 盆栽園検索フォームコンポーネント
 * @description 盆栽園の検索・フィルタリング・ソート機能を提供するClient Component。
 * キーワード検索、ジャンルフィルター、地方・都道府県フィルター、ソート順の選択が可能で、
 * 選択時に自動的にURLパラメータを更新してページを再レンダリングする。
 */

'use client'

// Next.jsのルーター・検索パラメータ取得フック
import { useRouter, useSearchParams } from 'next/navigation'
// Reactの状態管理・トランジション管理フック
import { useState, useTransition } from 'react'
// 地方・都道府県データ
import { REGIONS, PREFECTURES } from '@/lib/prefectures'
import { ROUTE_SHOPS } from '@/lib/constants/routes'

/**
 * ジャンルデータの型定義
 */
interface Genre {
  id: string       // ジャンルID
  name: string     // ジャンル名
  category: string // カテゴリ（グループ分け用）
}

/**
 * コンポーネントのProps型定義
 */
interface ShopSearchFormProps {
  genres: Genre[]           // 利用可能なジャンル一覧
  initialSearch?: string    // 初期検索キーワード
  initialGenre?: string     // 初期選択ジャンルID
  initialRegion?: string    // 初期選択地方ID
  initialPrefecture?: string // 初期選択都道府県
  initialSort?: string      // 初期ソート順
}

/**
 * 検索アイコンコンポーネント
 * 検索入力フィールドに表示するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/**
 * 盆栽園検索フォームコンポーネント
 *
 * このClient Componentは以下の機能を提供する:
 * 1. キーワード検索（名前または住所で検索）
 * 2. ジャンルフィルター（カテゴリごとにグループ化して表示）
 * 3. ソート順の選択（新着順、評価順、名前順）
 * 4. フィルターのリセット機能
 *
 * useTransitionを使用してナビゲーション中のローディング状態を管理し、
 * URLパラメータを更新することでServer Componentの再レンダリングをトリガーする。
 *
 * @param genres - 利用可能なジャンル一覧
 * @param initialSearch - URLから取得した初期検索キーワード
 * @param initialGenre - URLから取得した初期選択ジャンル
 * @param initialSort - URLから取得した初期ソート順
 */
export function ShopSearchForm({
  genres,
  initialSearch = '',
  initialGenre = '',
  initialRegion = '',
  initialPrefecture = '',
  initialSort = 'location',
}: ShopSearchFormProps) {
  // Next.jsルーター: プログラマティックなナビゲーション用
  const router = useRouter()
  // 現在のURLパラメータを取得
  const searchParams = useSearchParams()
  // トランジション管理: ナビゲーション中のローディング状態を管理
  const [isPending, startTransition] = useTransition()

  // ローカル状態: フォーム入力値を管理
  const [search, setSearch] = useState(initialSearch)   // 検索キーワード
  const [genre, setGenre] = useState(initialGenre)       // 選択ジャンル
  const [region, setRegion] = useState(initialRegion)    // 選択地方
  const [prefecture, setPrefecture] = useState(initialPrefecture) // 選択都道府県
  const [sort, setSort] = useState(initialSort)          // ソート順

  // 選択された地方に属する都道府県を取得
  const selectedRegionData = REGIONS.find(r => r.id === region)
  const availablePrefectures = selectedRegionData
    ? selectedRegionData.prefectures
    : [...PREFECTURES]

  /**
   * 検索実行ハンドラ
   * 現在のフォーム値からURLパラメータを構築してナビゲーション
   */
  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())

    // 検索キーワードの設定（空の場合は削除）
    if (search.trim()) {
      params.set('search', search.trim())
    } else {
      params.delete('search')
    }

    // ジャンルフィルターの設定（未選択の場合は削除）
    if (genre) {
      params.set('genre', genre)
    } else {
      params.delete('genre')
    }

    // 地方フィルターの設定（未選択の場合は削除）
    if (region) {
      params.set('region', region)
    } else {
      params.delete('region')
    }

    // 都道府県フィルターの設定（未選択の場合は削除）
    if (prefecture) {
      params.set('prefecture', prefecture)
    } else {
      params.delete('prefecture')
    }

    // ソート順の設定（デフォルトのlocationの場合は削除）
    if (sort && sort !== 'location') {
      params.set('sort', sort)
    } else {
      params.delete('sort')
    }

    // トランジションを使用してナビゲーション（UIをブロックしない）
    startTransition(() => {
      router.push(`${ROUTE_SHOPS}?${params.toString()}`)
    })
  }

  /**
   * フィルターリセットハンドラ
   * 全ての検索条件をクリアして初期状態に戻す
   */
  const handleReset = () => {
    setSearch('')
    setGenre('')
    setRegion('')
    setPrefecture('')
    setSort('location')
    startTransition(() => {
      router.push(ROUTE_SHOPS)
    })
  }

  /**
   * キーダウンハンドラ
   * Enterキーで検索を実行
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // ジャンルをカテゴリごとにグループ化（select要素のoptgroup用）
  const groupedGenres = genres.reduce((acc: Record<string, Genre[]>, g: Genre) => {
    const bucket = acc[g.category] ?? (acc[g.category] = [])
    bucket.push(g)
    return acc
  }, {})

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      {/* 検索入力セクション */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          {/* 検索アイコン */}
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          {/* 検索入力フィールド */}
          <label htmlFor="shop-search" className="sr-only">
            盆栽園を名前または住所で検索
          </label>
          <input
            id="shop-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="名前または住所で検索..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {/* 検索ボタン */}
        <button
          onClick={handleSearch}
          disabled={isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? '検索中...' : '検索'}
        </button>
      </div>

      {/* フィルターセクション */}
      <div className="flex flex-wrap gap-4">
        {/* ジャンルフィルター */}
        <div className="flex items-center gap-2">
          <label htmlFor="shop-filter-genre" className="text-sm text-muted-foreground">ジャンル:</label>
          <select
            id="shop-filter-genre"
            value={genre}
            onChange={(e) => {
              setGenre(e.target.value)
              // ジャンル選択時に自動で検索を実行
              const params = new URLSearchParams(searchParams.toString())
              if (e.target.value) {
                params.set('genre', e.target.value)
              } else {
                params.delete('genre')
              }
              startTransition(() => {
                router.push(`${ROUTE_SHOPS}?${params.toString()}`)
              })
            }}
            className="px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">すべて</option>
            {/* カテゴリごとにoptgroupで表示 */}
            {Object.entries(groupedGenres).map(([category, categoryGenres]) => (
              <optgroup key={category} label={category}>
                {categoryGenres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* 地方フィルター */}
        <div className="flex items-center gap-2">
          <label htmlFor="shop-filter-region" className="text-sm text-muted-foreground">地方:</label>
          <select
            id="shop-filter-region"
            value={region}
            onChange={(e) => {
              const newRegion = e.target.value
              setRegion(newRegion)
              // 地方が変わったら都道府県をリセット
              setPrefecture('')
              // 地方選択時に自動で検索を実行
              const params = new URLSearchParams(searchParams.toString())
              if (newRegion) {
                params.set('region', newRegion)
              } else {
                params.delete('region')
              }
              params.delete('prefecture') // 都道府県もリセット
              startTransition(() => {
                router.push(`${ROUTE_SHOPS}?${params.toString()}`)
              })
            }}
            className="px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">すべて</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* 都道府県フィルター */}
        <div className="flex items-center gap-2">
          <label htmlFor="shop-filter-prefecture" className="text-sm text-muted-foreground">都道府県:</label>
          <select
            id="shop-filter-prefecture"
            value={prefecture}
            onChange={(e) => {
              setPrefecture(e.target.value)
              // 都道府県選択時に自動で検索を実行
              const params = new URLSearchParams(searchParams.toString())
              if (e.target.value) {
                params.set('prefecture', e.target.value)
              } else {
                params.delete('prefecture')
              }
              startTransition(() => {
                router.push(`${ROUTE_SHOPS}?${params.toString()}`)
              })
            }}
            className="px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="">すべて</option>
            {availablePrefectures.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>

        {/* ソート順フィルター */}
        <div className="flex items-center gap-2">
          <label htmlFor="shop-filter-sort" className="text-sm text-muted-foreground">並び順:</label>
          <select
            id="shop-filter-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              // ソート選択時に自動で検索を実行
              const params = new URLSearchParams(searchParams.toString())
              if (e.target.value && e.target.value !== 'location') {
                params.set('sort', e.target.value)
              } else {
                params.delete('sort')
              }
              startTransition(() => {
                router.push(`${ROUTE_SHOPS}?${params.toString()}`)
              })
            }}
            className="px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          >
            <option value="location">北から順</option>
            <option value="newest">新着順</option>
            <option value="rating">評価順</option>
            <option value="name">名前順</option>
          </select>
        </div>

        {/* リセットボタン（フィルターが適用されている場合のみ表示） */}
        {(search || genre || region || prefecture || sort !== 'location') && (
          <button
            onClick={handleReset}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            リセット
          </button>
        )}
      </div>
    </div>
  )
}
