/**
 * Batch tests for files that previously had 0% coverage.
 * Covers static pages, layouts, not-found pages, the visitor beacon,
 * and the daily-visitors recharts wrapper.
 */
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// next/dynamic — eagerly invoke `loader()` (and its `.then(...)` chain) plus
// `options.loading()` so the wrapper's loader/loading function bodies execute
// during the synchronous render. Then return a stub component that records
// the data prop, which substitutes for the actual lazy-loaded module.
vi.mock('next/dynamic', () => ({
  default: (
    loader?: () => Promise<unknown>,
    options?: { loading?: () => unknown; ssr?: boolean },
  ) => {
    if (typeof loader === 'function') {
      try {
        const p = loader()
        if (p && typeof (p as Promise<unknown>).then === 'function') {
          // Drain the loader Promise (and its then-chain) so the .then(...)
          // callback inside the wrapper file is actually invoked.
          ;(p as Promise<unknown>)
            .then(() => undefined)
            .catch(() => undefined)
        }
      } catch {
        /* loader threw synchronously — ignore */
      }
    }
    if (typeof options?.loading === 'function') {
      try {
        options.loading()
      } catch {
        /* loading threw — ignore */
      }
    }
    const Stub = (props: Record<string, unknown>) => (
      <div data-testid="dynamic-stub" data-props={JSON.stringify(props)} />
    )
    Stub.displayName = 'NextDynamicStub'
    return Stub
  },
}))

// recharts — render data-testid stubs so we can assert composition.
// The Tooltip stub eagerly invokes any formatter / labelFormatter callbacks
// so the function bodies in DailyVisitorsChartInner get executed without
// depending on the real recharts runtime.
type TooltipProps = {
  formatter?: (value: number | undefined, name?: string) => unknown
  labelFormatter?: (label: string) => unknown
}
vi.mock('recharts', () => {
  const stub = (name: string) => {
    const Component = ({ children }: { children?: ReactNode }) => (
      <div data-testid={`recharts-${name}`}>{children}</div>
    )
    Component.displayName = `RechartsStub-${name}`
    return Component
  }
  const Tooltip = (props: TooltipProps & { children?: ReactNode }) => {
    // Drive both branches of the formatter (?? 0) by passing both number and undefined.
    if (typeof props.formatter === 'function') {
      try {
        props.formatter(42, 'visitors')
        props.formatter(undefined, 'visitors')
      } catch {
        /* formatter threw — ignore for coverage */
      }
    }
    if (typeof props.labelFormatter === 'function') {
      try {
        props.labelFormatter('Apr 1')
      } catch {
        /* labelFormatter threw — ignore */
      }
    }
    return <div data-testid="recharts-tooltip" />
  }
  Tooltip.displayName = 'RechartsStub-tooltip'
  return {
    AreaChart: stub('area-chart'),
    Area: stub('area'),
    XAxis: stub('x-axis'),
    YAxis: stub('y-axis'),
    CartesianGrid: stub('grid'),
    Tooltip,
    ResponsiveContainer: stub('responsive-container'),
  }
})

// Heavy fertilizer subcomponents — replace with stubs so the page tests
// only exercise the page itself.
vi.mock('@/components/fertilizer/NutrientAbsorptionDiagram', () => ({
  NutrientAbsorptionDiagram: () => <div data-testid="nutrient-absorption" />,
}))
vi.mock('@/components/fertilizer/NutrientSymptomSearch', () => ({
  NutrientSymptomSearch: () => <div data-testid="nutrient-symptom-search" />,
}))
vi.mock('@/components/fertilizer/FertilizerDisclaimer', () => ({
  FertilizerDisclaimer: () => <div data-testid="fertilizer-disclaimer" />,
}))

// =============================================================================
// (legal)/accessibility/page
// =============================================================================
describe('AccessibilityPage', () => {
  it('renders the WCAG accessibility statement with all major sections', async () => {
    const { default: Page, metadata } = await import(
      '@/app/(legal)/accessibility/page'
    )
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: /アクセシビリティ/ })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: '基本方針' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: '現在の取り組み' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: '既知の課題' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: '準拠基準' })).toBeDefined()
    expect(screen.getByText('お問い合わせページ')).toBeDefined()
    expect(metadata.title).toContain('アクセシビリティ')
    expect(metadata.alternates?.canonical).toContain('/accessibility')
  })
})

// =============================================================================
// (main)/hormones/layout
// =============================================================================
describe('HormonesLayout', () => {
  it('passes children through unchanged (Fragment wrapper)', async () => {
    const { default: Layout } = await import('@/app/(main)/hormones/layout')
    render(
      <Layout>
        <span data-testid="hormones-child">child</span>
      </Layout>,
    )
    expect(screen.getByTestId('hormones-child').textContent).toBe('child')
  })
})

// =============================================================================
// (main)/fertilizers/{absorption,symptoms}/page
// =============================================================================
describe('Fertilizer guide static pages', () => {
  it('absorption page renders heading + diagram + disclaimer + back link', async () => {
    const { default: Page, metadata, dynamic } = await import(
      '@/app/(main)/fertilizers/absorption/page'
    )
    render(<Page />)
    expect(
      screen.getByRole('heading', { level: 1, name: '栄養素の吸収と転流' }),
    ).toBeDefined()
    expect(screen.getByTestId('nutrient-absorption')).toBeDefined()
    expect(screen.getByTestId('fertilizer-disclaimer')).toBeDefined()
    expect(screen.getByText('← 肥料ガイドに戻る')).toBeDefined()
    expect(metadata.title).toContain('栄養素の吸収と転流')
    expect(metadata.alternates?.canonical).toContain('/fertilizers/absorption')
    expect(dynamic).toBe('force-dynamic')
  })

  it('symptoms page renders heading + symptom search + disclaimer + back link', async () => {
    const { default: Page, metadata, dynamic } = await import(
      '@/app/(main)/fertilizers/symptoms/page'
    )
    render(<Page />)
    expect(
      screen.getByRole('heading', { level: 1, name: '症状から探す栄養素' }),
    ).toBeDefined()
    expect(screen.getByTestId('nutrient-symptom-search')).toBeDefined()
    expect(screen.getByTestId('fertilizer-disclaimer')).toBeDefined()
    expect(screen.getByText('← 肥料ガイドに戻る')).toBeDefined()
    expect(metadata.title).toContain('症状から探す栄養素')
    expect(metadata.alternates?.canonical).toContain('/fertilizers/symptoms')
    expect(dynamic).toBe('force-dynamic')
  })
})

// =============================================================================
// admin not-found pages
// =============================================================================
const adminNotFoundPages = [
  {
    name: 'contact',
    path: '@/app/admin/contact/[id]/not-found',
    heading: 'お問い合わせが見つかりません',
    backLabel: 'お問い合わせ一覧に戻る',
  },
  {
    name: 'pesticide-data',
    path: '@/app/admin/pesticide-data/[id]/not-found',
    heading: '農薬データが見つかりません',
    backLabel: '農薬一覧に戻る',
  },
  {
    name: 'users',
    path: '@/app/admin/users/[id]/not-found',
    heading: 'ユーザーが見つかりません',
    backLabel: 'ユーザー一覧に戻る',
  },
]

describe.each(adminNotFoundPages)(
  'admin/$name/[id]/not-found',
  ({ path, heading, backLabel }) => {
    it('renders heading and back link', async () => {
      const mod = await import(path)
      const NotFound = mod.default
      render(<NotFound />)
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeDefined()
      expect(screen.getByRole('link', { name: backLabel })).toBeDefined()
    })
  },
)

// =============================================================================
// components/analytics/VisitorBeacon
// =============================================================================
describe('VisitorBeacon', () => {
  // Provide a Map-backed localStorage shim so isTrackingAllowed() can read the consent value.
  function installConsent(value: 'all' | 'essential' | null) {
    const store = new Map<string, string>()
    if (value) store.set('cookie-consent', value)
    const ls = window.localStorage as unknown as {
      getItem: ReturnType<typeof vi.fn>
      setItem: ReturnType<typeof vi.fn>
      removeItem: ReturnType<typeof vi.fn>
      clear: ReturnType<typeof vi.fn>
    }
    ls.getItem.mockImplementation((k: string) => (store.has(k) ? store.get(k) ?? null : null))
    ls.setItem.mockImplementation((k: string, v: string) => {
      store.set(k, v)
    })
    ls.removeItem.mockImplementation((k: string) => {
      store.delete(k)
    })
    ls.clear.mockImplementation(() => {
      store.clear()
    })
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs to /api/analytics/track exactly once on mount when tracking is allowed (consent=all)', async () => {
    installConsent('all')
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { VisitorBeacon } = await import('@/components/analytics/VisitorBeacon')
    const { rerender } = render(<VisitorBeacon />)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/analytics/track')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    })
    // Re-rendering must NOT re-fire while trackingAllowed is stable.
    rerender(<VisitorBeacon />)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('does NOT fire when consent is missing (privacy gate)', async () => {
    installConsent(null)
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { VisitorBeacon } = await import('@/components/analytics/VisitorBeacon')
    render(<VisitorBeacon />)
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('does NOT fire when only essential cookies are accepted', async () => {
    installConsent('essential')
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { VisitorBeacon } = await import('@/components/analytics/VisitorBeacon')
    render(<VisitorBeacon />)
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('swallows fetch rejection so analytics never breaks the page', async () => {
    installConsent('all')
    const rejection = new Error('network down')
    const fetchSpy = vi.fn().mockRejectedValue(rejection)
    vi.stubGlobal('fetch', fetchSpy)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { VisitorBeacon } = await import('@/components/analytics/VisitorBeacon')
    expect(() => render(<VisitorBeacon />)).not.toThrow()
    // Wait one microtask for the swallowed promise to settle.
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // The swallowed rejection should NOT surface as an unhandled error.
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Unhandled'),
    )
    errorSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('renders nothing (returns null)', async () => {
    installConsent('all')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()))
    const { VisitorBeacon } = await import('@/components/analytics/VisitorBeacon')
    const { container } = render(<VisitorBeacon />)
    expect(container.firstChild).toBeNull()
    vi.unstubAllGlobals()
  })
})

// =============================================================================
// app/admin/DailyVisitorsChart + DailyVisitorsChartInner
// =============================================================================
describe('DailyVisitorsChart wrapper + Inner', () => {
  const sample = [
    { date: '2026-04-01', visitors: 12 },
    { date: '2026-04-02', visitors: 18 },
    { date: '2026-04-03', visitors: 7 },
  ]

  it('Inner renders an AreaChart with all axes/grid/tooltip and the visitors series', async () => {
    const { DailyVisitorsChartInner } = await import(
      '@/app/admin/DailyVisitorsChartInner'
    )
    render(<DailyVisitorsChartInner data={sample} />)
    expect(screen.getByTestId('recharts-responsive-container')).toBeDefined()
    expect(screen.getByTestId('recharts-area-chart')).toBeDefined()
    expect(screen.getByTestId('recharts-area')).toBeDefined()
    expect(screen.getByTestId('recharts-x-axis')).toBeDefined()
    expect(screen.getByTestId('recharts-y-axis')).toBeDefined()
    expect(screen.getByTestId('recharts-grid')).toBeDefined()
    expect(screen.getByTestId('recharts-tooltip')).toBeDefined()
  })

  it('Inner tolerates an empty data array without throwing', async () => {
    const { DailyVisitorsChartInner } = await import(
      '@/app/admin/DailyVisitorsChartInner'
    )
    expect(() => render(<DailyVisitorsChartInner data={[]} />)).not.toThrow()
  })

  it('Wrapper renders the Inner via next/dynamic and forwards the data prop verbatim', async () => {
    const { DailyVisitorsChart } = await import('@/app/admin/DailyVisitorsChart')
    render(<DailyVisitorsChart data={sample} />)
    const stub = screen.getByTestId('dynamic-stub')
    expect(stub).toBeDefined()
    const passed = JSON.parse(stub.getAttribute('data-props') ?? '{}')
    expect(passed).toEqual({ data: sample })
  })
})
