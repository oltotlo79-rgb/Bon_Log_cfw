/**
 * ジャンル選択コンポーネント
 *
 * @module components/post/GenreSelector
 */

'use client'

/**
 * React useState Hook
 * ドロップダウンの開閉状態管理
 */
import { useState } from 'react'

/**
 * shadcn/uiのButtonコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * ジャンルの型
 *
 * @property id - ジャンルID
 * @property name - ジャンル名（表示用）
 * @property category - カテゴリ名（グループ化用）
 */
type Genre = {
  id: string
  name: string
  category: string
}

/**
 * GenreSelectorコンポーネントのprops型
 *
 * @property genres - カテゴリ名をキーとしたジャンル配列のマップ
 * @property selectedIds - 選択されているジャンルIDの配列
 * @property onChange - 選択変更時のコールバック
 * @property maxSelections - 最大選択数（デフォルト3）
 */
type GenreSelectorProps = {
  genres: Record<string, Genre[]>
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxSelections?: number
}

/**
 * 下向き矢印アイコン
 * ドロップダウンの開閉インジケーター
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
 * ジャンル選択コンポーネント
 *
 * ## 機能
 * - クリックでドロップダウンを開閉
 * - カテゴリ別にジャンルを表示
 * - 複数選択（トグル形式）
 * - 最大選択数の制限
 *
 * ## 制限事項
 * - 最大選択数に達すると、未選択のジャンルは無効化
 *
 * @param genres - カテゴリ別ジャンルマップ
 * @param selectedIds - 選択中のジャンルID配列
 * @param onChange - 選択変更コールバック
 * @param maxSelections - 最大選択数
 *
 * @example
 * ```tsx
 * <GenreSelector
 *   genres={{
 *     '松柏類': [{ id: '1', name: '黒松', category: '松柏類' }],
 *     '雑木類': [{ id: '2', name: 'もみじ', category: '雑木類' }],
 *   }}
 *   selectedIds={['1']}
 *   onChange={(ids) => setSelectedGenres(ids)}
 *   maxSelections={3}
 * />
 * ```
 */
export function GenreSelector({ genres, selectedIds, onChange, maxSelections = 3 }: GenreSelectorProps) {

  /**
   * ドロップダウンの開閉状態
   */
  const [isOpen, setIsOpen] = useState(false)

  /**
   * ジャンル選択のトグルハンドラ
   *
   * ## 動作
   * - 選択済み: 選択を解除
   * - 未選択かつ上限未満: 選択を追加
   * - 未選択かつ上限に達している: 何もしない
   *
   * @param genreId - トグルするジャンルのID
   */
  function toggleGenre(genreId: string) {
    if (selectedIds.includes(genreId)) {
      /**
       * 既に選択されている場合: 選択を解除
       */
      onChange(selectedIds.filter(id => id !== genreId))
    } else if (selectedIds.length < maxSelections) {
      /**
       * 上限未満の場合: 選択を追加
       */
      onChange([...selectedIds, genreId])
    }
  }

  /**
   * 選択されたジャンルの名前を取得
   *
   * ボタンのラベルに表示するため、
   * 選択中のジャンルIDから名前を取得
   */
  const selectedNames = Object.values(genres)
    .flat()
    .filter(g => selectedIds.includes(g.id))
    .map(g => g.name)

  return (
    <div className="relative">
      {/* ドロップダウントリガーボタン */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        {/* 選択済みジャンル名を表示（未選択時はプレースホルダー） */}
        <span className="truncate">
          {selectedNames.length > 0
            ? selectedNames.join(', ')
            : 'ジャンルを選択（任意）'}
        </span>
        {/* 開閉インジケーター（開いている時は180度回転） */}
        <ChevronDownIcon className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* ドロップダウンパネル（上方向に開く） */}
      {isOpen && (
        <div className="absolute z-10 bottom-full mb-1 w-full bg-popover border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {/* カテゴリごとにグループ化 */}
          {Object.entries(genres).map(([category, categoryGenres]) => (
            <div key={category} className="p-2">
              {/* カテゴリヘッダー */}
              <p className="text-xs font-medium text-muted-foreground mb-1 px-2">{category}</p>

              {/* ジャンルボタン群 */}
              <div className="flex flex-wrap gap-1">
                {categoryGenres.map(genre => {
                  /**
                   * 選択状態を判定
                   */
                  const isSelected = selectedIds.includes(genre.id)

                  /**
                   * 無効化判定: 未選択かつ上限に達している場合
                   */
                  const isDisabled = !isSelected && selectedIds.length >= maxSelections

                  return (
                    <button
                      key={genre.id}
                      type="button"
                      onClick={() => toggleGenre(genre.id)}
                      disabled={isDisabled}
                      className={`
                        px-2 py-1 text-xs rounded-full transition-colors
                        ${isSelected
                          ? 'bg-bonsai-green text-white'
                          : isDisabled
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-muted hover:bg-muted/80'
                        }
                      `}
                    >
                      {genre.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 選択数カウンター（1つ以上選択時のみ表示） */}
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {selectedIds.length}/{maxSelections} 選択中
        </p>
      )}
    </div>
  )
}
