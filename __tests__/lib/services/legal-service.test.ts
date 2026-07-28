// @vitest-environment node
/**
 * lib/services/legal-service のユニットテスト
 *
 * getLegalDocument の各 slug・未知 slug の戻り値、
 * listLegalDocuments の件数・フィールドを検証する。
 *
 * audience 分離 (2026-07-28) 以降、このサービスは常に ANDROID_LEGAL_DOCUMENTS を
 * 返す（Web の WEB_LEGAL_DOCUMENTS は参照しない）。Android 本文は Stripe 決済・
 * 固定円価格を持たないため、旧来の価格文字列アサーションは撤去し、
 * android 向け内容であることを検証するアサーションに置き換える。
 */
import { vi, describe, it, expect } from 'vitest'
import { WEB_LEGAL_DOCUMENTS } from '@/lib/constants/legal/web'

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

  it('tokushoho の body に Google Play Billing の記載がある（android 向け内容）', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('tokushoho')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const allBody = result.document.sections.map((s) => s.body).join('\n')
    expect(allBody).toContain('Google Play Billing')
  })

  it('tokushoho の body に固定円価格 (350 / 3,500) を含まない（android は Google Play 表示額を正とする）', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('tokushoho')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const allBody = result.document.sections.map((s) => s.body).join('\n')
    expect(allBody).not.toContain('350円')
    expect(allBody).not.toContain('3,500円')
  })

  it('tokushoho の body に Stripe / クレジットカード決済の記載がない', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('tokushoho')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const allBody = result.document.sections.map((s) => s.body).join('\n')
    expect(allBody).not.toContain('Stripe')
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

describe('audience 取り違え防止', () => {
  it('getLegalDocument("terms").updatedAt は android の値 (2026-07-28) である', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('terms')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.updatedAt).toBe('2026-07-28')
  })

  it('getLegalDocument("terms").updatedAt は WEB_LEGAL_DOCUMENTS.terms.updatedAt と異なる', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    const result = getLegalDocument('terms')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.updatedAt).not.toBe(WEB_LEGAL_DOCUMENTS.terms.updatedAt)
  })

  it('全 slug で getLegalDocument().updatedAt が WEB_LEGAL_DOCUMENTS と異なる（web 本文の誤参照防止）', async () => {
    const { getLegalDocument } = await import('@/lib/services/legal-service')
    for (const slug of ['tokushoho', 'terms', 'privacy'] as const) {
      const result = getLegalDocument(slug)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.document.updatedAt).not.toBe(WEB_LEGAL_DOCUMENTS[slug].updatedAt)
    }
  })

  it('listLegalDocuments() の updatedAt も android の値である（一覧 API の取り違え防止）', async () => {
    const { listLegalDocuments } = await import('@/lib/services/legal-service')
    const items = listLegalDocuments()
    for (const item of items) {
      expect(item.updatedAt).toBe('2026-07-28')
    }
  })
})
