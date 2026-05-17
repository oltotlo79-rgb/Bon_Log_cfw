import { describe, it, expect } from 'vitest'
import { parseAdminCursor, buildAdminQueryString } from '@/lib/utils/admin-cursor'

describe('parseAdminCursor', () => {
  it('cursor も trail も無ければ undefined / 空配列を返す', () => {
    expect(parseAdminCursor({})).toEqual({ cursor: undefined, trail: [] })
  })

  it('空文字列の cursor は undefined として扱う', () => {
    expect(parseAdminCursor({ cursor: '' })).toEqual({ cursor: undefined, trail: [] })
  })

  it('cursor が指定されればそのまま返す', () => {
    expect(parseAdminCursor({ cursor: 'abc' })).toEqual({ cursor: 'abc', trail: [] })
  })

  it('trail はカンマで分割される', () => {
    expect(parseAdminCursor({ cursor: 'c3', trail: 'c1,c2' })).toEqual({
      cursor: 'c3',
      trail: ['c1', 'c2'],
    })
  })

  it('trail 内の空要素は filter(Boolean) で除外される', () => {
    expect(parseAdminCursor({ trail: 'c1,,c2,' })).toEqual({
      cursor: undefined,
      trail: ['c1', 'c2'],
    })
  })

  it('trail のみ（カンマだけ）は空配列', () => {
    expect(parseAdminCursor({ trail: ',,' })).toEqual({ cursor: undefined, trail: [] })
  })

  it('trail が空文字列なら空配列', () => {
    expect(parseAdminCursor({ trail: '' })).toEqual({ cursor: undefined, trail: [] })
  })
})

describe('buildAdminQueryString', () => {
  it('全パラメータが空なら空文字列を返す', () => {
    expect(buildAdminQueryString({})).toBe('')
    expect(buildAdminQueryString({ cursor: undefined })).toBe('')
    expect(buildAdminQueryString({ cursor: '', trail: null })).toBe('')
  })

  it('値があれば ? で始めて & 区切りで連結', () => {
    expect(buildAdminQueryString({ cursor: 'abc', trail: 'x,y' })).toBe('?cursor=abc&trail=x%2Cy')
  })

  it('undefined / null / 空文字列のキーは出力されない', () => {
    expect(
      buildAdminQueryString({
        cursor: 'abc',
        page: undefined,
        sort: null,
        empty: '',
      }),
    ).toBe('?cursor=abc')
  })

  it('値は encodeURIComponent でエンコードされる', () => {
    expect(buildAdminQueryString({ q: 'hello world' })).toBe('?q=hello%20world')
    expect(buildAdminQueryString({ q: '日本語' })).toBe(
      `?q=${encodeURIComponent('日本語')}`,
    )
    expect(buildAdminQueryString({ q: 'a&b=c' })).toBe('?q=a%26b%3Dc')
  })

  it('キーも encodeURIComponent でエンコードされる', () => {
    expect(buildAdminQueryString({ 'a key': 'v' })).toBe('?a%20key=v')
  })

  it('入力プロパティの順序を維持する', () => {
    expect(buildAdminQueryString({ b: '2', a: '1', c: '3' })).toBe('?b=2&a=1&c=3')
  })

  it('parseAdminCursor → buildAdminQueryString → parseAdminCursor で round-trip 可能', () => {
    const parsed = parseAdminCursor({ cursor: 'c3', trail: 'c1,c2' })
    const qs = buildAdminQueryString({
      cursor: parsed.cursor,
      trail: parsed.trail.join(','),
    })
    expect(qs).toBe('?cursor=c3&trail=c1%2Cc2')
    // simulate Next.js searchParam decoding
    const params = new URLSearchParams(qs.slice(1))
    expect(parseAdminCursor({ cursor: params.get('cursor') ?? undefined, trail: params.get('trail') ?? undefined })).toEqual({
      cursor: 'c3',
      trail: ['c1', 'c2'],
    })
  })
})
