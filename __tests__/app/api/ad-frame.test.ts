// @vitest-environment node
import { GET } from '@/app/api/ad-frame/route'
import { NextRequest } from 'next/server'

function createRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /api/ad-frame', () => {
  it('returns 400 when no id param', async () => {
    const res = await GET(createRequest('/api/ad-frame'))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Invalid ad ID')
  })

  it('returns 400 for invalid id (non-hex)', async () => {
    const res = await GET(createRequest('/api/ad-frame?id=not-valid'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for id with wrong length', async () => {
    const res = await GET(createRequest('/api/ad-frame?id=abcdef'))
    expect(res.status).toBe(400)
  })

  it('returns HTML with correct headers for valid 32-char hex id', async () => {
    const validId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const res = await GET(createRequest(`/api/ad-frame?id=${validId}`))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('Content-Security-Policy')).toContain("'unsafe-inline'")

    const html = await res.text()
    expect(html).toContain(validId)
    expect(html).toContain('adm.shinobi.jp')
  })

  it('returns 400 for id longer than 32 chars', async () => {
    const res = await GET(createRequest(`/api/ad-frame?id=${'a'.repeat(33)}`))
    expect(res.status).toBe(400)
  })

  it('returns 400 for uppercase hex id', async () => {
    const res = await GET(createRequest('/api/ad-frame?id=ABCDEF0123456789ABCDEF0123456789'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty id string', async () => {
    const res = await GET(createRequest('/api/ad-frame?id='))
    expect(res.status).toBe(400)
  })

  it('returns HTML containing style tag', async () => {
    const validId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const res = await GET(createRequest(`/api/ad-frame?id=${validId}`))
    const html = await res.text()
    expect(html).toContain('<style>')
    expect(html).toContain('display:flex')
  })

  it('広告 iframe の CSP は default-src=none を維持し、script/frame は https:、connect は絞る', async () => {
    const validId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const res = await GET(createRequest(`/api/ad-frame?id=${validId}`))
    const csp = res.headers.get('Content-Security-Policy') ?? ''

    // 旧実装の `default-src *` が復活していないことを確認
    expect(csp).toMatch(/default-src 'none'/)
    expect(csp).not.toMatch(/default-src \*/)

    // script-src は passback チェーンに対応するため https: を許可（業界標準）
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline' 'unsafe-eval' https:/)
    // frame-src も同様に https: 許可（ad-stir → Rubicon / GMO 等の任意 SSP iframe 生成に対応）
    expect(csp).toMatch(/frame-src 'self' https:/)

    // connect-src はホワイトリスト維持（データ流出先の制限）
    expect(csp).toContain('*.shinobi.jp')
    expect(csp).toContain('googlesyndication.com')
    expect(csp).toContain('doubleclick.net')
    expect(csp).toContain('*.im-apps.net')
    expect(csp).toContain('*.criteo.net')
    expect(csp).toContain('*.criteo.com')

    // 危険な object-src / form-action / base-uri は明示的に禁止
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(csp).toContain("base-uri 'none'")
    // 外部埋め込み禁止
    expect(csp).toContain("frame-ancestors 'self'")
  })

  it('Referrer-Policy ヘッダーが strict-origin-when-cross-origin で設定される', async () => {
    const validId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const res = await GET(createRequest(`/api/ad-frame?id=${validId}`))
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})
