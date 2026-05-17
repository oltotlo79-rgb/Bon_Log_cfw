/**
 * 検索タブコンポーネント
 *
 * @module components/search/SearchTabs
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
 * タブの型定義
 *
 * @property id - タブの識別子（URLパラメータに使用）
 * @property label - タブに表示するラベル（日本語）
 */
type Tab = {
  /** タブの識別子（posts, users, tags） */
  id: string
  /** タブに表示するラベルテキスト */
  label: string
}

/**
 * 利用可能なタブの一覧
 *
 * - posts: 投稿の検索結果
 * - users: ユーザーの検索結果
 * - tags: タグの検索結果
 */
const tabs: Tab[] = [
  { id: 'posts', label: '投稿' },
  { id: 'users', label: 'ユーザー' },
  { id: 'tags', label: 'タグ' },
]

/**
 * SearchTabsコンポーネントのprops型
 *
 * @property activeTab - 現在アクティブなタブのID（デフォルト: 'posts'）
 */
type SearchTabsProps = {
  /** 現在選択されているタブのID */
  activeTab?: string
}

/**
 * 検索タブコンポーネント
 *
 * 検索結果ページでの投稿・ユーザー・タグの切り替えを行うタブコンポーネント。
 * タブをクリックするとURLのtabパラメータが更新され、対応する検索結果が表示される。
 *
 * ## 動作
 * 1. タブクリック時にURLのtabパラメータを更新
 * 2. 他のパラメータ（q, genre等）は維持
 * 3. アクティブタブは下線とテキスト色でハイライト
 *
 * @param activeTab - 現在アクティブなタブのID（デフォルト: 'posts'）
 *
 * @example
 * ```tsx
 * // 投稿タブがアクティブ
 * <SearchTabs activeTab="posts" />
 *
 * // ユーザータブがアクティブ
 * <SearchTabs activeTab="users" />
 * ```
 */
export function SearchTabs({ activeTab = 'posts' }: SearchTabsProps) {

  /**
   * Next.jsルーター
   * タブ切り替え時のページ遷移に使用
   */
  const router = useRouter()

  /**
   * URLクエリパラメータ
   * 現在のパラメータを取得し、tabパラメータを更新するために使用
   */
  const searchParams = useSearchParams()

  /**
   * タブ切り替えハンドラ
   *
   * 選択されたタブに応じてURLのtabパラメータを更新し、ページ遷移を行う。
   * 既存の検索クエリ（q）やジャンルフィルタ（genre）は維持される。
   *
   * @param tabId - 選択されたタブのID
   */
  const handleTabChange = (tabId: string) => {
    /**
     * 現在のURLパラメータを複製
     * これにより既存のパラメータ（q, genre等）を維持
     */
    const params = new URLSearchParams(searchParams.toString())

    /**
     * tabパラメータを新しいタブIDで更新
     */
    params.set('tab', tabId)

    /**
     * 更新されたパラメータで検索ページに遷移
     */
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="flex border-b">
      {/* タブボタンの一覧をマップで生成 */}
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'text-primary' // アクティブタブ: プライマリカラー
              : 'text-muted-foreground hover:text-foreground' // 非アクティブ: グレー（ホバーで色変化）
          }`}
        >
          {/* タブラベル */}
          {tab.label}

          {/* アクティブタブの下線インジケーター */}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  )
}
