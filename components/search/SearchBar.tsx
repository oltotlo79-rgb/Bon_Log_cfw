/**
 * 検索バーコンポーネント。
 *
 * テキスト検索 + 最近の検索ドロップダウン + キーボードショートカット（`/` でフォーカス）+
 * URL クエリと入力値の双方向同期を提供する。
 *
 * @module components/search/SearchBar
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search as SearchIcon, X as XIcon, Clock as ClockIcon } from 'lucide-react'

import { STORAGE_KEY_RECENT_SEARCHES } from '@/lib/constants/storage-keys'
import { ROUTE_SEARCH } from '@/lib/constants/routes'
import { MAX_RECENT_SEARCHES } from '@/lib/constants/limits'

function getRecentSearches(): string[] {
  // SSR 中は localStorage が存在しないため空配列で返す
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RECENT_SEARCHES)
    return stored ? JSON.parse(stored) : []
  } catch {
    // JSON パース失敗時はストレージ破損とみなして空に倒す
    return []
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return
  try {
    const searches = getRecentSearches()
    // 重複を除去して先頭に積み直すことで「最後に検索したもの」が常に最上段になる
    const filtered = searches.filter(s => s !== query)
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(STORAGE_KEY_RECENT_SEARCHES, JSON.stringify(updated))
  } catch {
    // QuotaExceededError などはユーザー操作を阻害しないよう握りつぶす
  }
}

function removeRecentSearch(query: string) {
  if (typeof window === 'undefined') return
  try {
    const searches = getRecentSearches()
    const updated = searches.filter(s => s !== query)
    localStorage.setItem(STORAGE_KEY_RECENT_SEARCHES, JSON.stringify(updated))
  } catch {
    // 上記 saveRecentSearch と同方針
  }
}

function clearRecentSearches() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY_RECENT_SEARCHES)
  } catch {
    // 上記 saveRecentSearch と同方針
  }
}

type SearchBarProps = {
  defaultValue?: string
  /** 指定時はナビゲーションせずコールバックを呼ぶ（モーダル内検索などで使用） */
  onSearch?: (query: string) => void
  placeholder?: string
}

export function SearchBar({ defaultValue = '', onSearch, placeholder = '検索...' }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(defaultValue)
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 履歴は localStorage 由来のためマウント後にのみ読み込む（SSR 時 hydration mismatch 回避）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage 由来の履歴を hydration mismatch 回避のためマウント後に読込
    setRecentSearches(getRecentSearches())
  }, [])

  // ブラウザの戻る/進む等で URL の `q` が変化したら入力値を追従させる
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 戻る/進むで URL の q が変化した際に入力値へ追従
      setQuery(q)
    }
  }, [searchParams])

  // `/` キーで素早く検索にフォーカス（INPUT/TEXTAREA 内では発火させない）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = useCallback((searchQuery?: string) => {
    const q = searchQuery ?? query
    if (q.trim()) {
      saveRecentSearch(q.trim())
      setRecentSearches(getRecentSearches())
    }
    if (onSearch) {
      onSearch(q)
    } else {
      const params = new URLSearchParams(searchParams.toString())
      if (q) {
        params.set('q', q)
      } else {
        params.delete('q')
      }
      router.push(`${ROUTE_SEARCH}?${params.toString()}`)
    }
    setIsFocused(false)
  }, [query, onSearch, router, searchParams])

  const handleClear = useCallback(() => {
    setQuery('')
    if (onSearch) {
      onSearch('')
    } else {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('q')
      router.push(`${ROUTE_SEARCH}?${params.toString()}`)
    }
  }, [onSearch, router, searchParams])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch()
      } else if (e.key === 'Escape') {
        setIsFocused(false)
        inputRef.current?.blur()
      }
    },
    [handleSearch]
  )

  const handleRecentSearchClick = (search: string) => {
    setQuery(search)
    handleSearch(search)
  }

  const handleRemoveRecentSearch = (search: string, e: React.MouseEvent) => {
    // 親 li の onClick（履歴を選んで検索）への伝播を抑止
    e.stopPropagation()
    removeRecentSearch(search)
    setRecentSearches(getRecentSearches())
  }

  const handleClearAll = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  // 入力中は履歴を出さない（候補と競合してノイズになるため）
  const showDropdown = isFocused && recentSearches.length > 0 && !query

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative flex items-center">
        <SearchIcon className="absolute left-3 w-5 h-5 text-muted-foreground pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          data-search-input
          data-testid="search-input"
          aria-label="検索"
        />

        {query && (
          <button
            onClick={handleClear}
            aria-label="検索をクリア"
            className="absolute right-3 p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium text-muted-foreground">最近の検索</span>
            <button
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              すべて削除
            </button>
          </div>

          <ul>
            {recentSearches.map((search) => (
              // 履歴選択と削除を兄弟要素にすることで `<button>` 内 `<button>` の
              // HTML5 仕様違反を回避（ネストした button はブラウザにより解釈差・スクリーンリーダー混乱を生む）
              <li key={search} className="flex items-center hover:bg-muted transition-colors">
                <button
                  onClick={() => handleRecentSearchClick(search)}
                  className="flex-1 flex items-center gap-3 px-3 py-2 text-left min-w-0"
                >
                  <ClockIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{search}</span>
                </button>
                <button
                  onClick={(e) => handleRemoveRecentSearch(search, e)}
                  aria-label="履歴を削除"
                  className="p-2 mr-1 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
