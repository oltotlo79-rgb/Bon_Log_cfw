/**
 * 水墨画の生成済み画像を背景に、タイトルをオーバーレイしてOG画像を動的生成。
 *
 * @usage
 * - デフォルト: /api/og
 * - カスタム: /api/og?title=投稿タイトル
 */

import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import {
  OG_TITLE_MAX_LENGTH,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  OG_CACHE_MAX_AGE_SECONDS,
  OG_CACHE_SWR_SECONDS,
} from '@/lib/constants/limits'
import { rateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'

// Next.js 14+ では `next/og` が Node.js / Edge 双方で動作する。
// Next.js 16 で `runtime = 'edge'` を明示すると "edge runtime disables static generation" の
// 警告が出るため、デフォルト（Node.js）に統一する。動的レスポンスのため SSG 化はそもそも不要。

const size = {
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
}

const CACHE_CONTROL_VALUE = `public, max-age=${OG_CACHE_MAX_AGE_SECONDS}, s-maxage=${OG_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${OG_CACHE_SWR_SECONDS}`

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await rateLimit(`og:${ip}`, RATE_LIMITS.api)
  if (!rl.success) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((rl.resetTime - Date.now()) / 1000)) },
    })
  }

  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')

  // 生成済みOG画像のURLを構築
  // 注: next/og (Satori) は WebP 非対応のため PNG を使用すること
  const ogBgUrl = new URL('/images/generated/ui/og-default.png', request.url).toString()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
        }}
      >
        {/* 水墨画背景: next/og (Satori) は React 風JSX を解釈するが next/image は使えないため
            生 <img> を使う（next/image は Next.js client runtime に依存する）。 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse 内では next/image 不可 */}
        <img
          src={ogBgUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '65%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '60px 80px 60px 40px',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#1a1a1a',
              letterSpacing: '0.08em',
              marginBottom: '16px',
              display: 'flex',
            }}
          >
            BON-LOG
          </div>

          <div
            style={{
              fontSize: title ? '30px' : '26px',
              color: '#4a4a4a',
              lineHeight: 1.5,
              maxWidth: '600px',
              display: 'flex',
            }}
          >
            {title
              ? title.length > OG_TITLE_MAX_LENGTH
                ? title.substring(0, OG_TITLE_MAX_LENGTH) + '...'
                : title
              : '盆栽愛好家のためのコミュニティSNS'}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '40px',
            fontSize: '16px',
            color: '#888',
            display: 'flex',
          }}
        >
          bon-log.com
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control': CACHE_CONTROL_VALUE,
      },
    },
  )
}
