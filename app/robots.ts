import { MetadataRoute } from 'next'
import { BASE_URL } from '@/lib/constants/routes'

/**
 * `/bonsai/` `/drafts/` などは PROTECTED_PATHS に含まれるアプリ内 private 機能のため、
 * Googlebot を含む全 crawler に対して明示的に Disallow する。proxy で認証保護は
 * しているが、SEO 整合性として robots と sitemap で公開意図のない URL を一致させる。
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = BASE_URL

  const protectedPaths = [
    '/admin/',
    '/admin/*',
    '/api/',
    '/api/*',
    '/login',
    '/register',
    '/verify-email',
    '/auth/',
    '/settings/',
    '/settings/*',
    '/feed',
    '/bookmarks',
    '/notifications',
    '/messages/',
    '/messages/*',
    '/posts/scheduled/',
    '/posts/scheduled/*',
    '/analytics',
    '/bonsai',
    '/bonsai/',
    '/bonsai/*',
    '/drafts',
    '/drafts/',
    '/drafts/*',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          ...protectedPaths,
          '/*.json$',
          // トラッキングクエリのみ除外。filter 用のクエリ (/shops?prefecture=...) は
          // index 対象として残し、canonical で重複回避する。
          '/*?*utm_*',
          '/*?*gclid=*',
          '/*?*fbclid=*',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: protectedPaths.filter((p) => !p.endsWith('*')),
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
