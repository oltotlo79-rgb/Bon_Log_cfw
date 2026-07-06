import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/**
 * app/(main)/analytics/page.tsx 専用テスト。
 *
 * `AnalyticsContent` は Suspense 内の async ローカルコンポーネントで、
 * 他バッチテスト（pages-batch1.test.tsx）では act scope 警告を避けるため
 * JSX ツリーの存在確認に留めている。本ファイルでは JSX ツリーから
 * `AnalyticsContent` 要素を直接抽出し、その `type`（async 関数自体）を
 * 手動で呼び出すことで Promise.all の解決と 8 項目の成功/失敗分岐を検証する。
 */

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRedirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`)
})
vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

const mockGetPostAnalytics = vi.fn()
const mockGetLikeAnalytics = vi.fn()
const mockGetQuoteAnalytics = vi.fn()
const mockGetKeywordAnalytics = vi.fn()
const mockGetEngagementTrend = vi.fn()
const mockGetGenrePerformance = vi.fn()
const mockGetFollowerGrowth = vi.fn()
const mockGetPeriodComparison = vi.fn()
vi.mock('@/lib/actions/analytics', () => ({
  getPostAnalytics: (...args: unknown[]) => mockGetPostAnalytics(...args),
  getLikeAnalytics: (...args: unknown[]) => mockGetLikeAnalytics(...args),
  getQuoteAnalytics: (...args: unknown[]) => mockGetQuoteAnalytics(...args),
  getKeywordAnalytics: (...args: unknown[]) => mockGetKeywordAnalytics(...args),
  getEngagementTrend: (...args: unknown[]) => mockGetEngagementTrend(...args),
  getGenrePerformance: (...args: unknown[]) => mockGetGenrePerformance(...args),
  getFollowerGrowth: (...args: unknown[]) => mockGetFollowerGrowth(...args),
  getPeriodComparison: (...args: unknown[]) => mockGetPeriodComparison(...args),
}))

vi.mock('@/components/analytics/AnalyticsDashboard', () => ({
  AnalyticsDashboard: (props: Record<string, unknown>) => (
    <div data-testid="analytics-dashboard" data-props={JSON.stringify(props)} />
  ),
}))
vi.mock('@/components/analytics/PeriodFilter', () => ({
  PeriodFilter: () => <div data-testid="period-filter" />,
}))
vi.mock('@/components/subscription/PremiumUpgradeCard', () => ({
  PremiumUpgradeCard: ({ title }: { title: string }) => (
    <div data-testid="premium-card">{title}</div>
  ),
}))
vi.mock('lucide-react', () => {
  const icon = (name: string) => {
    const Icon = () => <span data-testid={`icon-${name}`} />
    Icon.displayName = name
    return Icon
  }
  return { BarChart3: icon('BarChart3'), Loader2: icon('Loader2') }
})

/** JSX ツリーを再帰的に探索し、関数名が一致する React 要素を返す */
function findElementByName(
  node: unknown,
  name: string,
): { type: (props: unknown) => unknown; props: Record<string, unknown> } | null {
  if (!node || typeof node !== 'object') return null
  const el = node as { type?: unknown; props?: { children?: unknown } }
  if (typeof el.type === 'function' && (el.type as { name?: string }).name === name) {
    return el as { type: (props: unknown) => unknown; props: Record<string, unknown> }
  }
  const children = el.props?.children
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementByName(child, name)
      if (found) return found
    }
  } else if (children && typeof children === 'object') {
    return findElementByName(children, name)
  }
  return null
}

const successResult = { success: true, data: { value: 1 } }
const failureResult = { success: false, error: 'boom' }

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockIsPremiumUser.mockResolvedValue(true)
    for (const fn of [
      mockGetPostAnalytics,
      mockGetLikeAnalytics,
      mockGetQuoteAnalytics,
      mockGetKeywordAnalytics,
      mockGetEngagementTrend,
      mockGetGenrePerformance,
      mockGetFollowerGrowth,
      mockGetPeriodComparison,
    ]) {
      fn.mockResolvedValue(successResult)
    }
  })

  it('未認証の場合はログインへリダイレクト', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/analytics/page')
    await expect(
      Page({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT:/login')
  })

  it('非プレミアムユーザーにはアップグレードカードを表示する', async () => {
    mockIsPremiumUser.mockResolvedValue(false)
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)
    expect(screen.getByTestId('premium-card')).toBeInTheDocument()
    expect(mockGetPostAnalytics).not.toHaveBeenCalled()
  })

  it('AnalyticsContent はすべて成功時、各データを AnalyticsDashboard にそのまま渡す', async () => {
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({ searchParams: Promise.resolve({ days: '7' }) })

    const contentEl = findElementByName(result, 'AnalyticsContent')
    expect(contentEl).not.toBeNull()
    expect(contentEl?.props.days).toBe(7)

    const dashboardEl = await (contentEl!.type as (p: unknown) => Promise<unknown>)(
      contentEl!.props,
    )
    render(dashboardEl as React.ReactElement)

    const el = screen.getByTestId('analytics-dashboard')
    const props = JSON.parse(el.getAttribute('data-props') ?? '{}')
    expect(props.postAnalytics).toEqual({ value: 1 })
    expect(props.likeAnalytics).toEqual({ value: 1 })
    expect(props.quoteAnalytics).toEqual({ value: 1 })
    expect(props.keywordAnalytics).toEqual({ value: 1 })
    expect(props.engagementTrend).toEqual({ value: 1 })
    expect(props.genrePerformance).toEqual({ value: 1 })
    expect(props.followerGrowth).toEqual({ value: 1 })
    expect(props.periodComparison).toEqual({ value: 1 })
  })

  it('AnalyticsContent はすべて失敗時、各データを null にフォールバックする', async () => {
    for (const fn of [
      mockGetPostAnalytics,
      mockGetLikeAnalytics,
      mockGetQuoteAnalytics,
      mockGetKeywordAnalytics,
      mockGetEngagementTrend,
      mockGetGenrePerformance,
      mockGetFollowerGrowth,
      mockGetPeriodComparison,
    ]) {
      fn.mockResolvedValue(failureResult)
    }
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({ searchParams: Promise.resolve({ days: '30' }) })

    const contentEl = findElementByName(result, 'AnalyticsContent')
    expect(contentEl).not.toBeNull()

    const dashboardEl = await (contentEl!.type as (p: unknown) => Promise<unknown>)(
      contentEl!.props,
    )
    render(dashboardEl as React.ReactElement)

    const el = screen.getByTestId('analytics-dashboard')
    const props = JSON.parse(el.getAttribute('data-props') ?? '{}')
    expect(props.postAnalytics).toBeNull()
    expect(props.likeAnalytics).toBeNull()
    expect(props.quoteAnalytics).toBeNull()
    expect(props.keywordAnalytics).toBeNull()
    expect(props.engagementTrend).toBeNull()
    expect(props.genrePerformance).toBeNull()
    expect(props.followerGrowth).toBeNull()
    expect(props.periodComparison).toBeNull()
  })

  it('AnalyticsContent は成功でも data が未定義なら null にフォールバックする（?? null 分岐）', async () => {
    const successNoData = { success: true }
    for (const fn of [
      mockGetPostAnalytics,
      mockGetLikeAnalytics,
      mockGetQuoteAnalytics,
      mockGetKeywordAnalytics,
      mockGetEngagementTrend,
      mockGetGenrePerformance,
      mockGetFollowerGrowth,
      mockGetPeriodComparison,
    ]) {
      fn.mockResolvedValue(successNoData)
    }
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({ searchParams: Promise.resolve({ days: '90' }) })

    const contentEl = findElementByName(result, 'AnalyticsContent')
    const dashboardEl = await (contentEl!.type as (p: unknown) => Promise<unknown>)(
      contentEl!.props,
    )
    render(dashboardEl as React.ReactElement)

    const el = screen.getByTestId('analytics-dashboard')
    const props = JSON.parse(el.getAttribute('data-props') ?? '{}')
    expect(props.postAnalytics).toBeNull()
    expect(props.likeAnalytics).toBeNull()
    expect(props.quoteAnalytics).toBeNull()
    expect(props.keywordAnalytics).toBeNull()
    expect(props.engagementTrend).toBeNull()
    expect(props.genrePerformance).toBeNull()
    expect(props.followerGrowth).toBeNull()
    expect(props.periodComparison).toBeNull()
  })

  it.each([
    { days: '7', expected: 7 },
    { days: '30', expected: 30 },
    { days: '90', expected: 90 },
    { days: '999', expected: 30 },
    { days: 'foo', expected: 30 },
    { days: undefined, expected: 30 },
  ])('days=$days は $expected 日として AnalyticsContent に渡る', async ({ days, expected }) => {
    const { default: Page } = await import('@/app/(main)/analytics/page')
    const result = await Page({
      searchParams: Promise.resolve(days === undefined ? {} : { days }),
    })
    // AnalyticsContent は Suspense 内の async ローカルコンポーネント。
    // render() で実際に描画すると suspend してしまうため JSX ツリーの props のみ検証する。
    const periodFilterEl = findElementByName(result, 'PeriodFilter')
    expect(periodFilterEl).not.toBeNull()
    const contentEl = findElementByName(result, 'AnalyticsContent')
    expect(contentEl?.props.days).toBe(expected)
  })
})
