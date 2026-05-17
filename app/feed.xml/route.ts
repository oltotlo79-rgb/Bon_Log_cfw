/**
 * RSSフィードAPI
 *
 * 最新の公開投稿をRSS 2.0形式で配信するエンドポイント
 * RSSリーダーや検索エンジンのコンテンツ発見に使用される
 *
 * @module app/feed.xml/route
 */

import { prisma } from '@/lib/db'
import { RSS_FEED_LIMIT, RSS_TITLE_MAX_LENGTH, RSS_CACHE_MAX_AGE_SECONDS } from '@/lib/constants/limits'
import { BASE_URL } from '@/lib/constants/routes'

/**
 * GET /feed.xml
 *
 * RSS 2.0フィードを生成して返す
 */
export async function GET() {
  const baseUrl = BASE_URL

  // 最新の公開投稿を取得（公開ユーザーの投稿のみ）
  const posts = await prisma.post.findMany({
    where: {
      user: {
        isPublic: true,
      },
      // リポストは除外（オリジナルコンテンツのみ）
      repostPostId: null,
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
        },
      },
      media: {
        take: 1,
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: RSS_FEED_LIMIT,
  })

  // RSS 2.0形式のXMLを生成
  const rssItems = posts
    .map((post: { id: string; content: string | null; createdAt: Date; user: { id: string; nickname: string }; media: { url: string; type: string }[] }) => {
      const title = post.content
        ? post.content.length > RSS_TITLE_MAX_LENGTH
          ? post.content.slice(0, RSS_TITLE_MAX_LENGTH) + '...'
          : post.content
        : '投稿'
      const description = post.content || ''
      const link = `${baseUrl}/posts/${post.id}`
      const pubDate = new Date(post.createdAt).toUTCString()
      const author = post.user.nickname

      // メディアがある場合はenclosureを追加
      const enclosure = post.media[0]
        ? `<enclosure url="${escapeXml(post.media[0].url)}" type="${post.media[0].type === 'video' ? 'video/mp4' : 'image/jpeg'}" />`
        : ''

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(author)}</author>
      <guid isPermaLink="true">${link}</guid>
      ${enclosure}
    </item>`
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BON-LOG - 盆栽愛好家のためのコミュニティSNS</title>
    <link>${baseUrl}</link>
    <description>盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。最新の投稿をお届けします。</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${baseUrl}/logo.png</url>
      <title>BON-LOG</title>
      <link>${baseUrl}</link>
    </image>
    ${rssItems}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${RSS_CACHE_MAX_AGE_SECONDS}, s-maxage=${RSS_CACHE_MAX_AGE_SECONDS}`, // 1時間キャッシュ
    },
  })
}

/**
 * XMLの特殊文字をエスケープ
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
