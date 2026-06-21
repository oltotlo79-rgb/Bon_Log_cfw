// @vitest-environment node
/**
 * lib/services/legal-service のユニットテスト
 *
 * getLegalDocument の各 slug・未知 slug の戻り値、
 * listLegalDocuments の件数・フィールド・価格定数の埋め込みを検証する。
 */
import { vi, describe, it, expect } from 'vitest'

vi.mock('server-only', () => ({}))

describe('getLegalDocument', () => {
  it('slug=tokushoho で ok:true と document を返す', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('tokushoho')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.slug).toBe('tokushoho')
    expect(result.document.title).toBe('特定商取引法に基づく表記')
  })

  it('slug=terms で ok:true と document を返す', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('terms')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.slug).toBe('terms')
    expect(result.document.title).toBe('利用規約')
  })

  it('slug=privacy で ok:true と document を返す', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('privacy')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.slug).toBe('privacy')
    expect(result.document.title).toBe('プライバシーポリシー')
  })

  it('未知 slug で ok:false notFound:true を返す', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('unknown')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.notFound).toBe(true)
  })

  it('空文字で ok:false を返す', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('')

    expect(result.ok).toBe(false)
  })

  it('document.sections は空でない配列を持つ（tokushoho）', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('tokushoho')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Array.isArray(result.document.sections)).toBe(true)
    expect(result.document.sections.length).toBeGreaterThan(0)
  })

  it('document.sections の各要素は {heading, body} を持つ', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('terms')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const section of result.document.sections) {
      expect(typeof section.heading).toBe('string')
      expect(typeof section.body).toBe('string')
      expect(section.heading.length).toBeGreaterThan(0)
    }
  })

  it('tokushoho の body に PREMIUM_PRICE_MONTHLY_JPY (350) が含まれる', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('tokushoho')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const allBody = result.document.sections.map((s) => s.body).join('\n')
    expect(allBody).toContain('350')
  })

  it('tokushoho の body に PREMIUM_PRICE_YEARLY_JPY (3500) が含まれる', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('tokushoho')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const allBody = result.document.sections.map((s) => s.body).join('\n')
    expect(allBody).toContain('3,500')
  })

  it('document.updatedAt は ISO 日付文字列形式である', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    for (const slug of ['tokushoho', 'terms', 'privacy']) {
      const result = getLegalDocument(slug)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.document.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('listLegalDocuments', () => {
  it('3 件返す（tokushoho / terms / privacy）', async () => {
    const { listLegalDocuments } = await import('@/lib/services/legal-service')
    const items = listLegalDocuments()

    expect(items).toHaveLength(3)
  })

  it('各アイテムに slug / title / updatedAt が含まれる', async () => {
    const { listLegalDocuments } = await import('@/lib/services/legal-service')
    const items = listLegalDocuments()

    for (const item of items) {
      expect(typeof item.slug).toBe('string')
      expect(typeof item.title).toBe('string')
      expect(typeof item.updatedAt).toBe('string')
      expect(item.slug.length).toBeGreaterThan(0)
      expect(item.title.length).toBeGreaterThan(0)
    }
  })

  it('sections フィールドを含まない（一覧は概要のみ）', async () => {
    const { listLegalDocuments } = await import('@/lib/services/legal-service')
    const items = listLegalDocuments()

    for (const item of items) {
      expect(item).not.toHaveProperty('sections')
    }
  })

  it('slug 一覧は ["tokushoho", "terms", "privacy"] を含む', async () => {
    const { listLegalDocuments } = await import('@/lib/services/legal-service')
    const items = listLegalDocuments()
    const slugs = items.map((i) => i.slug)

    expect(slugs).toContain('tokushoho')
    expect(slugs).toContain('terms')
    expect(slugs).toContain('privacy')
  })
})
