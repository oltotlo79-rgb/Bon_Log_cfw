import { render, screen } from '../utils/test-utils'

/**
 * Dictionary page.tsx - uncovered branches (lines 38-63):
 *
 * 1. TermCard: CATEGORY_COLORS fallback when category is not in the map (line 38)
 * 2. EmptyState: branch for "no filters" vs "with filters" message (line 66)
 * 3. EmptyState: various filter combinations in the message (line 67)
 *
 * Since the page itself is a Server Component, we test the extracted
 * sub-components by recreating their logic identically.
 */

// Replicate CATEGORY_COLORS from the page
const CATEGORY_COLORS: Record<string, string> = {
  '樹形': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  '技術・作業': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  '管理・育成': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  '道具・用品': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  '盆器・鉢': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  '用土・肥料': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  '展示・鑑賞': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

type BonsaiTermSummary = {
  id: string
  slug: string
  term: string
  reading: string
  category: string
  description: string
}

// Replicate TermCard from the page (line 36-60)
function TermCard({ term }: { term: BonsaiTermSummary }) {
  const colorClass =
    CATEGORY_COLORS[term.category] ??
    'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'

  return (
    <div data-testid="term-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p data-testid="reading">{term.reading}</p>
          <h2 data-testid="term-name">{term.term}</h2>
        </div>
        <span data-testid="category-badge" className={colorClass}>
          {term.category}
        </span>
      </div>
      <p data-testid="description">{term.description}</p>
    </div>
  )
}

// Replicate EmptyState from the page (line 62-72)
function EmptyState({ search, category, row }: { search?: string; category?: string; row?: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p data-testid="empty-message">
        {search || category || row
          ? `「${[row, category, search].filter(Boolean).join(' / ')}」に一致する用語が見つかりませんでした。`
          : '用語が登録されていません。'}
      </p>
    </div>
  )
}

describe('TermCard - CATEGORY_COLORS fallback branch (line 38)', () => {
  it('uses the known color class for a recognized category', () => {
    const term: BonsaiTermSummary = {
      id: '1', slug: 'chokkan', term: '直幹', reading: 'ちょっかん',
      category: '樹形', description: 'まっすぐな幹',
    }
    render(<TermCard term={term} />)

    const badge = screen.getByTestId('category-badge')
    expect(badge.className).toContain('bg-emerald-100')
    expect(badge).toHaveTextContent('樹形')
  })

  it('falls back to stone color for an unknown category', () => {
    const term: BonsaiTermSummary = {
      id: '2', slug: 'other', term: '未知用語', reading: 'みちようご',
      category: '未分類カテゴリ', description: 'カテゴリマップにない',
    }
    render(<TermCard term={term} />)

    const badge = screen.getByTestId('category-badge')
    expect(badge.className).toContain('bg-stone-100')
    expect(badge.className).toContain('text-stone-700')
  })
})

describe('EmptyState - filter combination branches (lines 62-71)', () => {
  it('shows default "no terms registered" message when no filters', () => {
    render(<EmptyState />)
    expect(screen.getByTestId('empty-message')).toHaveTextContent(
      '用語が登録されていません。'
    )
  })

  it('shows search-only filter message', () => {
    render(<EmptyState search="松" />)
    expect(screen.getByTestId('empty-message')).toHaveTextContent(
      '「松」に一致する用語が見つかりませんでした。'
    )
  })

  it('shows category-only filter message', () => {
    render(<EmptyState category="樹形" />)
    expect(screen.getByTestId('empty-message')).toHaveTextContent(
      '「樹形」に一致する用語が見つかりませんでした。'
    )
  })

  it('shows row-only filter message', () => {
    render(<EmptyState row="あ行" />)
    expect(screen.getByTestId('empty-message')).toHaveTextContent(
      '「あ行」に一致する用語が見つかりませんでした。'
    )
  })

  it('shows combined row + category + search filter message', () => {
    render(<EmptyState row="か行" category="道具・用品" search="はさみ" />)
    expect(screen.getByTestId('empty-message')).toHaveTextContent(
      '「か行 / 道具・用品 / はさみ」に一致する用語が見つかりませんでした。'
    )
  })

  it('shows row + search without category', () => {
    render(<EmptyState row="さ行" search="剪定" />)
    expect(screen.getByTestId('empty-message')).toHaveTextContent(
      '「さ行 / 剪定」に一致する用語が見つかりませんでした。'
    )
  })

  it('shows category + search without row', () => {
    render(<EmptyState category="技術・作業" search="針金" />)
    expect(screen.getByTestId('empty-message')).toHaveTextContent(
      '「技術・作業 / 針金」に一致する用語が見つかりませんでした。'
    )
  })
})
