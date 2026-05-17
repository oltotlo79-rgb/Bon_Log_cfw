// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { pageCanonical } from '@/lib/utils/seo'
import { BASE_URL } from '@/lib/constants/routes'

describe('pageCanonical', () => {
  it("'/' は BASE_URL をそのまま返す（末尾 / は付与しない）", () => {
    expect(pageCanonical('/')).toBe(BASE_URL)
  })

  it('空文字も BASE_URL を返す（防御的フォールバック）', () => {
    expect(pageCanonical('')).toBe(BASE_URL)
  })

  it('先頭スラッシュ付きパスを単純連結する', () => {
    expect(pageCanonical('/about')).toBe(`${BASE_URL}/about`)
  })

  it('先頭スラッシュ無しパスは正規化して連結する', () => {
    expect(pageCanonical('about')).toBe(`${BASE_URL}/about`)
  })

  it('深い階層パスでも正しく組み立てる', () => {
    expect(pageCanonical('/dictionary/auxin')).toBe(`${BASE_URL}/dictionary/auxin`)
  })

  it('クエリパラメータを含むパスはそのまま含める', () => {
    expect(pageCanonical('/bonsai?view=calendar')).toBe(`${BASE_URL}/bonsai?view=calendar`)
  })

  it('返り値は常に絶対 URL（http(s):// で始まる）', () => {
    expect(pageCanonical('/about')).toMatch(/^https?:\/\//)
    expect(pageCanonical('/')).toMatch(/^https?:\/\//)
  })
})
