// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractClientIp, getClientIpFromRequest } from '@/lib/utils/client-ip'

/**
 * 任意のヘッダー連想配列から `getHeader` 関数を生成する。
 * 大文字小文字を正規化して扱う (実際の HTTP ヘッダーは case-insensitive)。
 */
function makeGetter(headers: Record<string, string | undefined>) {
  const normalized = new Map<string, string>()
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) normalized.set(k.toLowerCase(), v)
  }
  return (name: string) => normalized.get(name.toLowerCase()) ?? null
}

describe('extractClientIp', () => {
  describe('優先順位', () => {
    it('fly-client-ip が最優先 (他ヘッダーがあっても採用)', () => {
      const ip = extractClientIp(
        makeGetter({
          'fly-client-ip': '0.0.0.1',
          'cf-connecting-ip': '1.1.1.1',
          'x-vercel-forwarded-for': '2.2.2.2',
          'x-forwarded-for': '3.3.3.3, 4.4.4.4, 5.5.5.5',
          'x-real-ip': '6.6.6.6',
        }),
      )
      expect(ip).toBe('0.0.0.1')
    })

    it('fly-client-ip が欠落していると既存チェーン (cf-connecting-ip) にフォールバックする', () => {
      const ip = extractClientIp(
        makeGetter({
          'cf-connecting-ip': '1.1.1.1',
          'x-vercel-forwarded-for': '2.2.2.2',
        }),
      )
      expect(ip).toBe('1.1.1.1')
    })

    it('fly-client-ip が空文字なら次の優先ヘッダーにフォールバックする', () => {
      const ip = extractClientIp(
        makeGetter({ 'fly-client-ip': '', 'cf-connecting-ip': '1.1.1.1' }),
      )
      expect(ip).toBe('1.1.1.1')
    })

    it('cf-connecting-ip が最優先 (他ヘッダーがあっても採用)', () => {
      const ip = extractClientIp(
        makeGetter({
          'cf-connecting-ip': '1.1.1.1',
          'x-vercel-forwarded-for': '2.2.2.2',
          'x-forwarded-for': '3.3.3.3, 4.4.4.4, 5.5.5.5',
          'x-real-ip': '6.6.6.6',
        }),
      )
      expect(ip).toBe('1.1.1.1')
    })

    it('cf が無いと x-vercel-forwarded-for が次優先', () => {
      const ip = extractClientIp(
        makeGetter({
          'x-vercel-forwarded-for': '2.2.2.2',
          'x-forwarded-for': '3.3.3.3, 4.4.4.4, 5.5.5.5',
          'x-real-ip': '6.6.6.6',
        }),
      )
      expect(ip).toBe('2.2.2.2')
    })

    it('cf / vercel が無いと x-forwarded-for を採用', () => {
      const ip = extractClientIp(
        makeGetter({
          'x-forwarded-for': '3.3.3.3, 4.4.4.4, 5.5.5.5',
          'x-real-ip': '6.6.6.6',
        }),
      )
      // 3 個ある場合は末尾から 2 番目 (4.4.4.4)
      expect(ip).toBe('4.4.4.4')
    })

    it('x-real-ip は他が全部無いときの最後の手段', () => {
      const ip = extractClientIp(makeGetter({ 'x-real-ip': '6.6.6.6' }))
      expect(ip).toBe('6.6.6.6')
    })

    it('すべて欠落すると "unknown"', () => {
      const ip = extractClientIp(makeGetter({}))
      expect(ip).toBe('unknown')
    })
  })

  describe('x-vercel-forwarded-for', () => {
    it('カンマ区切りの先頭を採用', () => {
      const ip = extractClientIp(
        makeGetter({ 'x-vercel-forwarded-for': '1.1.1.1, 10.0.0.1, 192.168.1.1' }),
      )
      expect(ip).toBe('1.1.1.1')
    })

    it('前後の空白を trim する', () => {
      const ip = extractClientIp(makeGetter({ 'x-vercel-forwarded-for': '  1.1.1.1  , 2.2.2.2' }))
      expect(ip).toBe('1.1.1.1')
    })

    it('空文字なら次の優先ヘッダーにフォールバック', () => {
      const ip = extractClientIp(
        makeGetter({ 'x-vercel-forwarded-for': '', 'x-real-ip': '6.6.6.6' }),
      )
      expect(ip).toBe('6.6.6.6')
    })

    it('カンマだけ (= 全要素空) なら次のヘッダーにフォールバック', () => {
      const ip = extractClientIp(makeGetter({ 'x-vercel-forwarded-for': ' , ', 'x-real-ip': '6.6.6.6' }))
      expect(ip).toBe('6.6.6.6')
    })
  })

  describe('x-forwarded-for: 末尾から 2 番目を採用するロジック', () => {
    it('要素数 1: 単一値がそのまま採用される', () => {
      const ip = extractClientIp(makeGetter({ 'x-forwarded-for': '1.2.3.4' }))
      expect(ip).toBe('1.2.3.4')
    })

    it('要素数 2: 先頭を採用 (末尾から 2 番目 ≠ 先頭になる境界の手前)', () => {
      // 仕様: ips.length > 2 のときのみ末尾-2、それ以外は先頭
      const ip = extractClientIp(makeGetter({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))
      expect(ip).toBe('1.1.1.1')
    })

    it('要素数 3: 末尾から 2 番目 (= 中央) を採用', () => {
      const ip = extractClientIp(makeGetter({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }))
      expect(ip).toBe('2.2.2.2')
    })

    it('要素数 5: 末尾から 2 番目 (= 4 番目) を採用', () => {
      const ip = extractClientIp(
        makeGetter({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3, 4.4.4.4, 5.5.5.5' }),
      )
      expect(ip).toBe('4.4.4.4')
    })

    it('空エントリ (",,,") はフィルタ除外され、残ったうち先頭/末尾-2 が採用', () => {
      const ip = extractClientIp(makeGetter({ 'x-forwarded-for': ',,1.1.1.1,2.2.2.2,,' }))
      // フィルタ後: ['1.1.1.1', '2.2.2.2'] → length 2 で先頭採用
      expect(ip).toBe('1.1.1.1')
    })

    it('要素が全て空ならフォールバックする', () => {
      const ip = extractClientIp(
        makeGetter({ 'x-forwarded-for': ', , ,', 'x-real-ip': '6.6.6.6' }),
      )
      expect(ip).toBe('6.6.6.6')
    })

    it('値の前後空白は trim される', () => {
      const ip = extractClientIp(
        makeGetter({ 'x-forwarded-for': '  1.1.1.1 ,   2.2.2.2  ,  3.3.3.3 ' }),
      )
      expect(ip).toBe('2.2.2.2')
    })
  })

  describe('IPv6', () => {
    it('IPv6 アドレスもそのまま採用', () => {
      const ip = extractClientIp(makeGetter({ 'cf-connecting-ip': '2001:db8::1' }))
      expect(ip).toBe('2001:db8::1')
    })
  })

  describe('フォールバック挙動', () => {
    it('cf-connecting-ip が空文字なら次のヘッダーにフォールバック', () => {
      const ip = extractClientIp(
        makeGetter({ 'cf-connecting-ip': '', 'x-vercel-forwarded-for': '2.2.2.2' }),
      )
      expect(ip).toBe('2.2.2.2')
    })

    it('x-real-ip が空文字なら "unknown"', () => {
      const ip = extractClientIp(makeGetter({ 'x-real-ip': '' }))
      expect(ip).toBe('unknown')
    })
  })
})

describe('getClientIpFromRequest', () => {
  it('Request の headers.get を経由して同じロジックを呼ぶ', () => {
    const req = new Request('https://example.com', {
      headers: {
        'cf-connecting-ip': '9.9.9.9',
        'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3',
      },
    })
    expect(getClientIpFromRequest(req)).toBe('9.9.9.9')
  })

  it('Request にヘッダーが無ければ "unknown"', () => {
    const req = new Request('https://example.com')
    expect(getClientIpFromRequest(req)).toBe('unknown')
  })

  it('Request の x-forwarded-for だけでも適切に解析', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' },
    })
    expect(getClientIpFromRequest(req)).toBe('2.2.2.2')
  })
})
