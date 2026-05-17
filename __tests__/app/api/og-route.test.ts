// @vitest-environment node

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'
// Mock ImageResponse since it requires edge runtime internals
const mockImageResponse = vi.fn()
vi.mock('next/og', () => ({
  ImageResponse: class MockImageResponse {
    status: number
    headers: Headers
    constructor(element: unknown, options?: Record<string, unknown>) {
      mockImageResponse(element, options)
      this.status = 200
      this.headers = new Headers({ 'content-type': 'image/png' })
    }
  },
}))

import { GET } from '@/app/api/og/route'
import { NextRequest } from 'next/server'

function createRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

type ReactLike = {
  type?: unknown
  props?: { src?: unknown; children?: unknown }
}

function findImgSrc(element: unknown): string | null {
  if (!element || typeof element !== 'object') return null
  const el = element as ReactLike
  if (el.type === 'img' && typeof el.props?.src === 'string') return el.props.src
  const children = el.props?.children
  if (Array.isArray(children)) {
    for (const c of children) {
      const found = findImgSrc(c)
      if (found) return found
    }
  } else if (children) {
    return findImgSrc(children)
  }
  return null
}

describe('GET /api/og', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an ImageResponse without title', async () => {
    const res = await GET(createRequest('/api/og'))
    expect(res).toBeDefined()
    expect(res.status).toBe(200)
  })

  it('returns an ImageResponse with title param', async () => {
    const res = await GET(createRequest('/api/og?title=テスト投稿'))
    expect(res).toBeDefined()
    expect(res.status).toBe(200)
  })

  it('returns an ImageResponse with long title', async () => {
    const longTitle = 'あ'.repeat(100)
    const res = await GET(createRequest(`/api/og?title=${encodeURIComponent(longTitle)}`))
    expect(res).toBeDefined()
    expect(res.status).toBe(200)
  })

  it('calls ImageResponse with correct size options (1200x630)', async () => {
    await GET(createRequest('/api/og'))
    expect(mockImageResponse).toHaveBeenCalledTimes(1)
    const [, options] = mockImageResponse.mock.calls[0]
    expect(options).toMatchObject({ width: 1200, height: 630 })
  })

  it('renders default content when no title param', async () => {
    await GET(createRequest('/api/og'))
    expect(mockImageResponse).toHaveBeenCalledTimes(1)
    const [element] = mockImageResponse.mock.calls[0]
    expect(element).toBeTruthy()
  })

  it('returns content-type image/png header', async () => {
    const res = await GET(createRequest('/api/og'))
    expect(res.headers.get('content-type')).toBe('image/png')
  })

  it('does not declare edge runtime (Next.js 16 default Node.js runtime is used to avoid the SSG-disable warning; next/og works in both runtimes since Next.js 14)', async () => {
    const mod = await import('@/app/api/og/route')
    expect((mod as { runtime?: string }).runtime).toBeUndefined()
  })

  it('uses PNG (not WebP) for OG background — Satori does not support WebP', async () => {
    await GET(createRequest('/api/og'))
    const [element] = mockImageResponse.mock.calls[0]
    const src = findImgSrc(element)
    expect(src).toBeTruthy()
    expect(src).toMatch(/\.png$/)
    expect(src).not.toMatch(/\.webp$/)
  })

  it('OG background PNG file exists under public/', () => {
    const pngPath = join(process.cwd(), 'public/images/generated/ui/og-default.png')
    expect(existsSync(pngPath)).toBe(true)
  })
})
