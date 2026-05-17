/**
 * ジャンルフィルタコンポーネント
 *
 * @module components/search/GenreFilter
 */

'use client'

/**
 * Next.js ナビゲーション
 *
 * useRouter: プログラム的なページ遷移に使用
 * useSearchParams: URLクエリパラメータの取得・更新に使用
 */
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * React Hooks
 *
 * useState: ドロップダウンの開閉状態を管理
 */
import { useState } from 'react'

/**
 * ジャンルの型定義
 *
 * @property id - ジャンルの一意識別子
 * @property name - ジャンル名（表示用）
 * @property category - 所属カテゴリ（グループ化用）
 */
type Genre = {
  /** ジャンルID（URLパラメータに使用） */
  id: string
  /** ジャンル名（日本語表示名） */
  name: string
  /** カテゴリ名（ジャンルのグループ化に使用） */
  category: string
}

/**
 * GenreFilterコンポーネントのprops型
 *
 * @property genres - カテゴリごとにグループ化されたジャンルデータ
 * @property selectedGenreIds - 現在選択されているジャンルIDの配列
 */
type GenreFilterProps = {
  /**
   * ジャンルデータ
   * キー: カテゴリ名
   * 値: そのカテゴリに属するジャンルの配列
   */
  genres: Record<string, Genre[]>
  /** 現在選択されているジャンルIDの配列 */
  selectedGenreIds?: string[]
}

/**
 * 下向き矢印アイコン（シェブロン）
 *
 * ドロップダウンの開閉状態を示すために使用
 * 開いている時は180度回転してアップになる
 *
 * @param className - 追加のCSSクラス
 */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/**
 * ジャンルフィルタコンポーネント
 *
 * 検索結果をジャンルで絞り込むためのドロップダウンメニュー。
 * 複数のジャンルを選択でき、URLパラメータに反映される。
 *
 * ## 動作
 * 1. ボタンクリックでドロップダウンを開閉
 * 2. ジャンルをクリックでトグル（選択/解除）
 * 3. 選択状態はURLの`genre`パラメータに反映
 * 4. 「クリア」ボタンで全選択を解除
 *
 * ## URLパラメータ
 * - 複数選択: `?genre=id1&genre=id2`
 * - 他パラメータ（q等）は維持される
 *
 * @param genres - カテゴリごとのジャンルデータ
 * @param selectedGenreIds - 選択中のジャンルID
 *
 * @example
 * ```tsx
 * <GenreFilter
 *   genres={{
 *     '盆栽の種類': [
 *       { id: 'shohaku', name: '松柏類', category: '盆栽の種類' },
 *       { id: 'zoki', name: '雑木類', category: '盆栽の種類' }
 *     ],
 *     'その他': [
 *       { id: 'tools', name: '用品・道具', category: 'その他' }
 *     ]
 *   }}
 *   selectedGenreIds={['shohaku']}
 * />
 * ```
 */
export function GenreFilter({ genres, selectedGenreIds = [] }: GenreFilterProps) {

  /**
   * Next.jsルーター
   * ジャンル選択時のURLパラメータ更新に使用
   */
  const router = useRouter()

  /**
   * URLクエリパラメータ
   * 現在のgenreパラメータを取得するために使用
   */
  const searchParams = useSearchParams()

  /**
   * ドロップダウンの開閉状態
   *
   * true: ドロップダウンが開いている
   * false: ドロップダウンが閉じている
   */
  const [isOpen, setIsOpen] = useState(false)

  /**
   * ジャンル選択トグルハンドラ
   *
   * 指定されたジャンルの選択状態を切り替える。
   * 選択済みの場合は解除、未選択の場合は追加。
   *
   * ## 処理フロー
   * 1. 現在のgenreパラメータを取得
   * 2. クリックされたジャンルが選択済みか確認
   * 3. 選択済み: パラメータから削除
   * 4. 未選択: パラメータに追加
   * 5. URLを更新してページ遷移
   *
   * @param genreId - トグルするジャンルのID
   */
  const handleGenreToggle = (genreId: string) => {
    /**
     * 現在のURLパラメータを複製
     */
    const params = new URLSearchParams(searchParams.toString())

    /**
     * 現在選択されているジャンルIDを取得
     * getAll()で同じキーの複数値を配列で取得
     */
    const currentGenres = params.getAll('genre')

    if (currentGenres.includes(genreId)) {
      /**
       * 既に選択されている場合: 削除
       *
       * 1. まず全てのgenreパラメータを削除
       * 2. クリックされたもの以外を再追加
       */
      params.delete('genre')
      currentGenres
        .filter((id) => id !== genreId)
        .forEach((id) => params.append('genre', id))
    } else {
      /**
       * 未選択の場合: 追加
       */
      params.append('genre', genreId)
    }

    /**
     * 更新されたパラメータで検索ページに遷移
     */
    router.push(`/search?${params.toString()}`)
  }

  /**
   * 全ジャンル選択解除ハンドラ
   *
   * 全てのgenreパラメータを削除してURLを更新
   */
  const clearAllGenres = () => {
    const params = new URLSearchParams(searchParams.toString())
    /**
     * genreパラメータを全て削除
     */
    params.delete('genre')
    router.push(`/search?${params.toString()}`)
  }

  /**
   * 選択されているジャンルの数
   * バッジ表示と「クリア」ボタンの表示制御に使用
   */
  const selectedCount = selectedGenreIds.length

  return (
    <div className="relative">
      {/* ドロップダウントリガーボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background hover:bg-muted transition-colors"
      >
        <span className="text-sm">
          ジャンル
          {/* 選択数バッジ（1つ以上選択時のみ表示） */}
          {selectedCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {selectedCount}
            </span>
          )}
        </span>

        {/* 開閉インジケーター（開いている時は反転） */}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <>
          {/* 背景オーバーレイ（クリックで閉じる） */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* ドロップダウンコンテンツ */}
          <div className="absolute top-full left-0 mt-2 w-72 bg-card border rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            {/* ヘッダー */}
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium">ジャンルで絞り込み</span>

              {/* クリアボタン（選択がある時のみ表示） */}
              {selectedCount > 0 && (
                <button
                  onClick={clearAllGenres}
                  className="text-xs text-primary hover:underline"
                >
                  クリア
                </button>
              )}
            </div>

            {/* ジャンルリスト（カテゴリごとにグループ化） */}
            <div className="p-2">
              {Object.entries(genres).map(([category, categoryGenres]) => (
                <div key={category} className="mb-3 last:mb-0">
                  {/* カテゴリラベル */}
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                    {category}
                  </p>

                  {/* ジャンルボタン群 */}
                  <div className="flex flex-wrap gap-1">
                    {categoryGenres.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => handleGenreToggle(genre.id)}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          selectedGenreIds.includes(genre.id)
                            ? 'bg-primary text-primary-foreground' // 選択済み: プライマリカラー
                            : 'bg-muted hover:bg-muted/80' // 未選択: グレー
                        }`}
                      >
                        {genre.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
