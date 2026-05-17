/** このファイルは盆栽の検索機能を提供するコンポーネントです。 */

'use client'

// React のフック: 状態管理、非同期処理、コールバックのメモ化に使用
import { useState, useTransition, useCallback } from 'react'
// Server Action: 盆栽を検索するサーバーサイド関数
import { searchBonsais } from '@/lib/actions/bonsai'
import { MAX_SEARCH_QUERY_LENGTH, DEBOUNCE_DELAY_MS } from '@/lib/constants/limits'

/**
 * 検索アイコン
 * @param className - カスタムCSSクラス
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
 * バツ印アイコン（クリアボタン用）
 * @param className - カスタムCSSクラス
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * ローディングアイコン（検索中の表示用）
 * @param className - カスタムCSSクラス
 */
function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

/**
 * BonsaiSearchコンポーネントのProps型定義
 */
interface BonsaiSearchProps {
  /** 検索結果を親コンポーネントに通知するコールバック */
  onSearch: (bonsais: BonsaiResult[]) => void
  /** 検索をクリアした時に呼び出されるコールバック */
  onClear: () => void
  /** 初期表示時の盆栽総数（「○本の盆栽を管理中」の表示用） */
  initialCount: number
}

/**
 * 検索結果の盆栽データ型定義
 */
type BonsaiResult = {
  /** 盆栽ID */
  id: string
  /** 盆栽の名前 */
  name: string
  /** 樹種（オプション） */
  species: string | null
  /** 入手日（オプション） */
  acquiredAt: Date | null
  /** 説明・メモ（オプション） */
  description: string | null
  /** 成長記録（サムネイル用） */
  records?: {
    images?: { url: string }[]
  }[]
  /** 成長記録の件数 */
  _count?: { records: number }
}

/**
 * 盆栽検索コンポーネント
 *
 * インクリメンタルサーチで盆栽を検索し、
 * 結果を親コンポーネントに通知します。
 * デバウンス処理で効率的な検索を実現しています。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.onSearch - 検索結果通知コールバック
 * @param props.onClear - 検索クリアコールバック
 * @param props.initialCount - 初期盆栽数
 */
export function BonsaiSearch({ onSearch, onClear, initialCount }: BonsaiSearchProps) {
  /**
   * 検索クエリ（入力値）の状態
   */
  const [query, setQuery] = useState('')

  /**
   * 非同期処理中かどうかのフラグ
   * useTransitionで非同期処理を優先度の低い更新として扱う
   */
  const [isPending, startTransition] = useTransition()

  /**
   * エラーメッセージの状態
   * null: エラーなし、string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * 検索結果の件数
   * null: 検索未実行、number: 検索結果件数
   */
  const [resultCount, setResultCount] = useState<number | null>(null)

  /**
   * デバウンス用タイマーの状態
   * 連続入力時に過剰なリクエストを防ぐ
   */
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  /**
   * 検索実行関数
   *
   * デバウンス処理（300ms）を適用し、
   * 連続入力時は最後の入力のみ検索を実行
   *
   * @param searchQuery - 検索キーワード
   */
  const handleSearch = useCallback((searchQuery: string) => {
    // 前回のタイマーをクリア
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    const trimmed = searchQuery.trim()

    // 空のクエリの場合は検索をクリア
    if (!trimmed) {
      setResultCount(null)
      setError(null)
      onClear()
      return
    }

    // デバウンス: DEBOUNCE_DELAY_MS後に検索実行
    const timer = setTimeout(() => {
      // startTransitionで非同期処理を開始（UIをブロックしない）
      startTransition(async () => {
        setError(null)
        // Server Actionで検索実行
        const result = await searchBonsais(trimmed)

        if (!result.success) {
          // エラー時
          setError(result.error)
          setResultCount(null)
          return
        }
        const bonsais = result.data?.bonsais
        if (bonsais) {
          // 成功時: 結果件数を保存し、親コンポーネントに通知
          setResultCount(bonsais.length)
          onSearch(bonsais)
        }
      })
    }, DEBOUNCE_DELAY_MS)

    setDebounceTimer(timer)
  }, [debounceTimer, onSearch, onClear])

  /**
   * 入力変更時のイベントハンドラ
   *
   * 入力値を更新し、検索を実行
   *
   * @param e - 入力変更イベント
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    handleSearch(value)
  }

  /**
   * 検索クリア時のイベントハンドラ
   *
   * クエリと検索結果をリセットし、
   * 親コンポーネントに全件表示を要求
   */
  const handleClear = () => {
    setQuery('')
    setResultCount(null)
    setError(null)
    onClear()
  }

  /**
   * フォーム送信時のイベントハンドラ
   *
   * Enterキーでの検索実行時に呼ばれる
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          {/* 検索アイコン */}
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          {/* 検索入力フィールド */}
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="盆栽を検索（名前・樹種・説明）"
            className="w-full pl-10 pr-10 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            maxLength={MAX_SEARCH_QUERY_LENGTH}
          />
          {/* ローディングインジケーター（検索中に表示） */}
          {isPending && (
            <LoaderIcon className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
          {/* クリアボタン（クエリがあり、検索中でない時に表示） */}
          {query && !isPending && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <XIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </form>

      {/* 検索結果のステータス表示 */}
      {error && (
        // エラーメッセージ
        <p className="text-sm text-destructive">{error}</p>
      )}
      {resultCount !== null && !error && (
        // 検索結果件数の表示
        <p className="text-sm text-muted-foreground">
          {resultCount === 0
            ? '該当する盆栽が見つかりませんでした'
            : `${resultCount}件の盆栽が見つかりました`}
        </p>
      )}
      {resultCount === null && !query && (
        // 初期状態: 管理中の盆栽数を表示
        <p className="text-sm text-muted-foreground">
          {initialCount}本の盆栽を管理中
        </p>
      )}
    </div>
  )
}
