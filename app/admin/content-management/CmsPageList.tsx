'use client'

/**
 * @file CMSページリストコンポーネント
 * @description CMSページの一覧・カテゴリフィルタ・作成・公開切替・削除を行うClient Component。
 */

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Trash2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Filter,
} from 'lucide-react'
import { createCmsPage, updateCmsPage, deleteCmsPage } from '@/lib/actions/admin/cms'

interface CmsPage {
  id: string
  slug: string
  title: string
  content: string
  category: string
  version: number
  isPublished: boolean
  publishedAt: string | null
  updatedAt: string
  createdAt: string
}

interface CmsPageListProps {
  pages: CmsPage[]
  total: number
  currentCategory: string
}

/** カテゴリラベル */
const categoryLabels: Record<string, string> = {
  help: 'ヘルプ',
  faq: 'FAQ',
  terms: '利用規約',
}

/** カテゴリバッジ色 */
const categoryColors: Record<string, string> = {
  help: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  faq: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  terms: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

export function CmsPageList({ pages, total, currentCategory }: CmsPageListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // 作成フォーム状態
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('help')

  const handleCategoryFilter = (cat: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (cat) {
      params.set('category', cat)
    } else {
      params.delete('category')
    }
    startTransition(() => {
      router.push(`/admin/content-management?${params.toString()}`)
    })
  }

  const handleCreate = () => {
    if (!slug.trim() || !title.trim()) {
      setFormError('スラグとタイトルは必須です')
      return
    }
    setFormError(null)
    startTransition(async () => {
      const result = await createCmsPage({
        slug: slug.trim(),
        title: title.trim(),
        content,
        category,
      })
      if (result && 'error' in result) {
        setFormError(result.error)
        return
      }
      setSlug('')
      setTitle('')
      setContent('')
      setCategory('help')
      setShowForm(false)
      router.refresh()
    })
  }

  const handleTogglePublish = (pageSlug: string, isPublished: boolean) => {
    startTransition(async () => {
      await updateCmsPage(pageSlug, { isPublished: !isPublished })
      router.refresh()
    })
  }

  const handleDelete = (pageSlug: string) => {
    if (!confirm('このページを削除しますか?')) return
    startTransition(async () => {
      await deleteCmsPage(pageSlug)
      router.refresh()
    })
  }

  const categories = ['', 'help', 'faq', 'terms']

  return (
    <div className="space-y-4">
      {/* カテゴリフィルタ + 作成ボタン */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex rounded-lg border overflow-hidden">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategoryFilter(cat)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  currentCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-muted'
                }`}
              >
                {cat ? categoryLabels[cat] || cat : 'すべて'}
              </button>
            ))}
          </div>
          {isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {/* 作成フォーム */}
      {showForm && (
        <div className="bg-card rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold">ページを作成</h3>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">スラグ</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                placeholder="例: how-to-use"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                placeholder="ページタイトル"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">カテゴリ</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
              >
                <option value="help">ヘルプ</option>
                <option value="faq">FAQ</option>
                <option value="terms">利用規約</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground min-h-[120px]"
              placeholder="ページの内容を入力..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              作成
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ページ一覧 */}
      <div className="bg-card rounded-lg border">
        {pages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            ページがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">タイトル</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">スラグ</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">カテゴリ</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ver.</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">状態</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">更新日</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{page.title}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      /{page.slug}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          categoryColors[page.category] || 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {categoryLabels[page.category] || page.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      v{page.version}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {page.isPublished ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          公開中
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
                          下書き
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(page.updatedAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/admin/content-management/${page.slug}`}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title="編集"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleTogglePublish(page.slug, page.isPublished)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title={page.isPublished ? '非公開にする' : '公開する'}
                        >
                          {page.isPublished ? (
                            <ToggleRight className="w-4 h-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(page.slug)}
                          disabled={isPending}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        全 {total} 件
      </p>
    </div>
  )
}
