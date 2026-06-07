// @vitest-environment node
/**
 * master-data 詳細ページの動的レンダリング設定テスト
 *
 * これらのページは (main) レイアウト / PremiumProvider が auth() (= headers) を使うため
 * 静的生成できない。以前は revalidate + generateStaticParams を宣言していたが、本番
 * (fly standalone) で DynamicServerError を起こしていたため force-dynamic へ統一した。
 * その回帰防止として、各ページが動的レンダリングを宣言し静的生成設定を持たないことを検証する。
 */
import { vi, describe, it, expect } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

vi.mock('@/lib/actions/dictionary', () => ({
  getTermBySlug: vi.fn(),
  getAdjacentTerms: vi.fn(),
}))

vi.mock('@/lib/actions/pesticide', () => ({
  getPesticideBySlug: vi.fn(),
  getDiseasePestBySlug: vi.fn(),
  getActiveIngredientBySlug: vi.fn(),
  getColumnBySlug: vi.fn(),
  getSpreaderTypeBySlug: vi.fn(),
}))

function expectForceDynamic(mod: Record<string, unknown>) {
  expect(mod.dynamic).toBe('force-dynamic')
  expect(mod.generateStaticParams).toBeUndefined()
  expect(mod.revalidate).toBeUndefined()
}

describe('master-data 詳細ページの動的レンダリング設定', () => {
  it('dictionary/[slug] は force-dynamic を宣言する', async () => {
    expectForceDynamic(await import('@/app/(main)/dictionary/[slug]/page'))
  })

  it('pesticides/products/[slug] は force-dynamic を宣言する', async () => {
    expectForceDynamic(await import('@/app/(main)/pesticides/products/[slug]/page'))
  })

  it('pesticides/diseases-pests/[slug] は force-dynamic を宣言する', async () => {
    expectForceDynamic(await import('@/app/(main)/pesticides/diseases-pests/[slug]/page'))
  })

  it('pesticides/ingredients/[slug] は force-dynamic を宣言する', async () => {
    expectForceDynamic(await import('@/app/(main)/pesticides/ingredients/[slug]/page'))
  })

  it('pesticides/columns/[slug] は force-dynamic を宣言する', async () => {
    expectForceDynamic(await import('@/app/(main)/pesticides/columns/[slug]/page'))
  })

  it('pesticides/spreaders/[slug] は force-dynamic を宣言する', async () => {
    expectForceDynamic(await import('@/app/(main)/pesticides/spreaders/[slug]/page'))
  })
})
