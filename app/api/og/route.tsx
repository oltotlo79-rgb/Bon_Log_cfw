/**
 * @file app/api/og/route.tsx
 * @description 動的OG画像生成API
 *
 * 水墨画の生成済み画像を背景に、タイトルをオーバーレイしてOG画像を動的生成。
 *
 * @usage
 * - デフォルト: /api/og
 * - カスタム: /api/og?title=投稿タイトル
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { OG_TITLE_MAX_LENGTH, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/lib/constants/limits'

// Next.js 14+ では `next/og` が Node.js / Edge 双方で動作する。
// Next.js 16 で `runtime = 'edge'` を明示すると "edge runtime disables static generation" の
// 警告が出るため、デフォルト（Node.js）に統一する。動的レスポンスのため SSG 化はそもそも不要。

const size = {
  width: OG_IMAGE_WIDTH,
  height: OG_IMAGE_HEIGHT,
}

export async function GET(request: NextRequest) {
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
        {/* 水墨画背景 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
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

        {/* 右側にテキストオーバーレイ（画像の右2/3は余白エリア） */}
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
          {/* サイト名 */}
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

          {/* タイトルまたはキャッチコピー */}
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

        {/* フッター */}
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
    { ...size }
  )
}
