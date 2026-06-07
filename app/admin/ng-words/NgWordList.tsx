'use client'


import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Regex,
  Loader2,
} from 'lucide-react'
import { createNgWord, deleteNgWord, toggleNgWord } from '@/lib/actions/admin/moderation'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MSG_ERROR_TITLE } from '@/lib/constants/messages'

interface NgWord {
  id: string
  word: string
  category: string
  isRegex: boolean
  isActive: boolean
  createdAt: Date | string
}

interface NgWordListProps {
  /** NGワード一覧 */
  words: NgWord[]
  /** 現在の検索キーワード */
  search: string
  /** 現在のカテゴリフィルター */
  category: string
}

/** カテゴリの日本語ラベル */
const categoryLabels: Record<string, string> = {
  spam: 'スパム',
  harassment: 'ハラスメント',
  inappropriate: '不適切',
}

/** カテゴリバッジの色 */
const categoryColors: Record<string, string> = {
  spam: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  harassment: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  inappropriate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
}

/**
 * NGワードリストコンポーネント
 * 検索・フィルタリング・CRUD操作を提供する
 */
export function NgWordList({ words, search, category }: NgWordListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  // 新規追加フォームの状態
  const [newWord, setNewWord] = useState('')
  const [newCategory, setNewCategory] = useState('inappropriate')
  const [newIsRegex, setNewIsRegex] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  // 削除確認ダイアログの対象（null のとき閉じている）
  const [deleteTarget, setDeleteTarget] = useState<NgWord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 検索フォームの状態
  const [searchInput, setSearchInput] = useState(search)

  /**
   * URLのクエリパラメータを更新してページ遷移。
   * cursor/trail はリセット（フィルター変更で先頭ページへ戻る）。
   */
  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    params.delete('cursor')
    params.delete('trail')
    startTransition(() => {
      router.push(`/admin/ng-words?${params.toString()}`)
    })
  }

  /**
   * 検索実行
   */
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    updateParams({ search: searchInput })
  }

  /**
   * カテゴリフィルター変更
   */
  function handleCategoryFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    updateParams({ category: e.target.value, page: '' })
  }

  /**
   * NGワード新規追加
   */
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newWord.trim()) {
      setFormError('ワードを入力してください')
      return
    }

    setIsAdding(true)
    setFormError(null)

    const result = await createNgWord({
      word: newWord.trim(),
      category: newCategory,
      isRegex: newIsRegex,
    })

    setIsAdding(false)

    if (result && 'error' in result) {
      setFormError(result.error)
      return
    }

    // フォームリセット
    setNewWord('')
    setNewIsRegex(false)
    startTransition(() => {
      router.refresh()
    })
  }

  /**
   * 削除確認ダイアログでの確定。失敗時は toast でエラーを表示する。
   */
  async function handleConfirmDelete() {
    const target = deleteTarget
    if (!target) return

    setIsDeleting(true)
    const result = await deleteNgWord(target.id)
    setIsDeleting(false)

    if (result && 'error' in result) {
      toast({ title: MSG_ERROR_TITLE, description: result.error, variant: 'destructive' })
      return
    }

    setDeleteTarget(null)
    startTransition(() => {
      router.refresh()
    })
  }

  /**
   * 有効/無効の切替
   */
  async function handleToggle(id: string) {
    const result = await toggleNgWord(id)
    if (result && 'error' in result) {
      toast({ title: MSG_ERROR_TITLE, description: result.error, variant: 'destructive' })
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-4">
        <h2 className="text-sm font-semibold mb-3">NGワードを追加</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="ng-word-input" className="block text-xs text-muted-foreground mb-1">
              ワード
            </label>
            <input
              id="ng-word-input"
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="NGワードを入力"
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
            />
          </div>

          <div>
            <label htmlFor="ng-word-category" className="block text-xs text-muted-foreground mb-1">
              カテゴリ
            </label>
            <select
              id="ng-word-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background text-sm"
            >
              <option value="spam">スパム</option>
              <option value="harassment">ハラスメント</option>
              <option value="inappropriate">不適切</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="ng-word-regex"
              type="checkbox"
              checked={newIsRegex}
              onChange={(e) => setNewIsRegex(e.target.checked)}
              className="rounded border"
            />
            <label htmlFor="ng-word-regex" className="text-sm flex items-center gap-1">
              <Regex className="h-4 w-4" />
              正規表現
            </label>
          </div>

          <button
            type="submit"
            disabled={isAdding}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            追加
          </button>
        </form>
        {formError && <p className="mt-2 text-sm text-destructive">{formError}</p>}
      </div>

      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex flex-1 min-w-[200px] gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ワードで検索..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg bg-background text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
            >
              検索
            </button>
          </form>

          <select
            value={category}
            onChange={handleCategoryFilter}
            className="px-3 py-2 border rounded-lg bg-background text-sm"
          >
            <option value="">全カテゴリ</option>
            <option value="spam">スパム</option>
            <option value="harassment">ハラスメント</option>
            <option value="inappropriate">不適切</option>
          </select>
        </div>
      </div>

      <div className="bg-card rounded-lg border relative">
        {isPending && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">ワード</th>
              <th className="text-left px-4 py-3 text-sm font-medium">カテゴリ</th>
              <th className="text-left px-4 py-3 text-sm font-medium">正規表現</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">作成日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {words.map((word) => (
              <tr key={word.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <code className="text-sm bg-muted px-2 py-0.5 rounded font-mono">
                    {word.word}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      categoryColors[word.category] || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {categoryLabels[word.category] || word.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {word.isRegex ? (
                    <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                      <Regex className="h-4 w-4" />
                      正規表現
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {word.isActive ? (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      有効
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      無効
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(word.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(word.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title={word.isActive ? '無効にする' : '有効にする'}
                    >
                      {word.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(word)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {words.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  NGワードが見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>NGワードを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.word}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
