import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'
import {
  SITEMAP_USERS_LIMIT,
  SITEMAP_POSTS_LIMIT,
  SITEMAP_SHOPS_LIMIT,
  SITEMAP_EVENTS_LIMIT,
  SITEMAP_DICTIONARY_LIMIT,
  SITEMAP_PESTICIDES_LIMIT,
  SITEMAP_DISEASE_PESTS_LIMIT,
  SITEMAP_PESTICIDE_COLUMNS_LIMIT,
  SITEMAP_ACTIVE_INGREDIENTS_LIMIT,
  SITEMAP_SPREADER_TYPES_LIMIT,
  SITEMAP_FERTILIZER_COLUMNS_LIMIT,
  SITEMAP_FERTILIZER_NUTRIENTS_LIMIT,
  SITEMAP_TREE_SPECIES_LIMIT,
  SITEMAP_HORMONE_TYPES_LIMIT,
  SITEMAP_HORMONE_COLUMNS_LIMIT,
} from '@/lib/constants/limits'
import {
  BASE_URL,
  ROUTE_ABOUT,
  ROUTE_ACCESSIBILITY,
  ROUTE_CONTACT,
  ROUTE_DICTIONARY,
  ROUTE_EVENTS,
  ROUTE_FERTILIZERS,
  ROUTE_FERTILIZERS_ABSORPTION,
  ROUTE_FERTILIZERS_CATEGORIES,
  ROUTE_FERTILIZERS_COLUMNS,
  ROUTE_FERTILIZERS_NUTRIENTS,
  ROUTE_FERTILIZERS_PRODUCTS,
  ROUTE_FERTILIZERS_SCHEDULES,
  ROUTE_FERTILIZERS_SOIL,
  ROUTE_FERTILIZERS_SYMPTOMS,
  ROUTE_FERTILIZERS_TROUBLES,
  ROUTE_FERTILIZERS_WATERING,
  ROUTE_HELP,
  ROUTE_HORMONES,
  ROUTE_HORMONE_CALENDAR,
  ROUTE_HORMONE_COLUMNS,
  ROUTE_HORMONE_DIAGRAM,
  ROUTE_HORMONE_INTERACTIONS,
  ROUTE_HORMONE_SIMULATOR,
  ROUTE_HORMONE_TECHNIQUES,
  ROUTE_PESTICIDES,
  ROUTE_PESTICIDES_COLUMNS,
  ROUTE_PESTICIDES_DILUTION,
  ROUTE_PESTICIDES_DISEASES_PESTS,
  ROUTE_PESTICIDES_FORMULATIONS,
  ROUTE_PESTICIDES_INGREDIENTS,
  ROUTE_PESTICIDES_MIXING,
  ROUTE_PESTICIDES_SPRAY_GUIDE,
  ROUTE_PESTICIDES_SPREADERS,
  ROUTE_PRIVACY,
  ROUTE_SHOPS,
  ROUTE_TERMS,
  ROUTE_TOKUSHOHO,
} from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'

export const dynamic = 'force-dynamic'

type StaticEntry = {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}

/**
 * 静的・半静的な公開ページ。
 * reference 系の list / index ページは検索流入の入口になるため明示的に列挙する。
 */
const STATIC_PAGES: readonly StaticEntry[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: ROUTE_ABOUT, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_CONTACT, changeFrequency: 'monthly', priority: 0.4 },
  { path: ROUTE_HELP, changeFrequency: 'monthly', priority: 0.4 },
  { path: ROUTE_PRIVACY, changeFrequency: 'monthly', priority: 0.3 },
  { path: ROUTE_TERMS, changeFrequency: 'monthly', priority: 0.3 },
  { path: ROUTE_TOKUSHOHO, changeFrequency: 'monthly', priority: 0.3 },
  { path: ROUTE_ACCESSIBILITY, changeFrequency: 'yearly', priority: 0.2 },
  { path: ROUTE_SHOPS, changeFrequency: 'daily', priority: 0.8 },
  { path: ROUTE_EVENTS, changeFrequency: 'daily', priority: 0.8 },
  { path: ROUTE_DICTIONARY, changeFrequency: 'weekly', priority: 0.7 },
  // 農薬関連 list
  { path: ROUTE_PESTICIDES, changeFrequency: 'weekly', priority: 0.7 },
  { path: ROUTE_PESTICIDES_COLUMNS, changeFrequency: 'weekly', priority: 0.6 },
  { path: ROUTE_PESTICIDES_DISEASES_PESTS, changeFrequency: 'monthly', priority: 0.6 },
  { path: ROUTE_PESTICIDES_FORMULATIONS, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_PESTICIDES_INGREDIENTS, changeFrequency: 'monthly', priority: 0.6 },
  { path: ROUTE_PESTICIDES_SPREADERS, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_PESTICIDES_SPRAY_GUIDE, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_PESTICIDES_DILUTION, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_PESTICIDES_MIXING, changeFrequency: 'monthly', priority: 0.5 },
  // 肥料関連 list
  { path: ROUTE_FERTILIZERS, changeFrequency: 'weekly', priority: 0.7 },
  { path: ROUTE_FERTILIZERS_ABSORPTION, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_FERTILIZERS_CATEGORIES, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_FERTILIZERS_COLUMNS, changeFrequency: 'weekly', priority: 0.6 },
  { path: ROUTE_FERTILIZERS_NUTRIENTS, changeFrequency: 'monthly', priority: 0.6 },
  { path: ROUTE_FERTILIZERS_PRODUCTS, changeFrequency: 'weekly', priority: 0.6 },
  { path: ROUTE_FERTILIZERS_SCHEDULES, changeFrequency: 'monthly', priority: 0.6 },
  { path: ROUTE_FERTILIZERS_SOIL, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_FERTILIZERS_SYMPTOMS, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_FERTILIZERS_TROUBLES, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_FERTILIZERS_WATERING, changeFrequency: 'monthly', priority: 0.5 },
  // 植物ホルモン関連 list
  { path: ROUTE_HORMONES, changeFrequency: 'weekly', priority: 0.7 },
  { path: ROUTE_HORMONE_TECHNIQUES, changeFrequency: 'monthly', priority: 0.6 },
  { path: ROUTE_HORMONE_DIAGRAM, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_HORMONE_CALENDAR, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_HORMONE_SIMULATOR, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_HORMONE_INTERACTIONS, changeFrequency: 'monthly', priority: 0.5 },
  { path: ROUTE_HORMONE_COLUMNS, changeFrequency: 'weekly', priority: 0.6 },
]

const REFERENCE_CHANGE_FREQUENCY: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']> = 'monthly'
const REFERENCE_PRIORITY = 0.6

// 静的ページの lastModified は「最後に静的ページの構成 / 文面が意味のある形で
// 更新された日」を表す固定値。`new Date()` を使うと sitemap が毎回変わって
// 検索エンジンに不要な再クロールを促すため、人が意識的に更新する。
// 公開ページに新しいルートを追加したり既存ページの文面を更新した際にここを bump する。
const STATIC_PAGES_LAST_MODIFIED = new Date('2026-05-13T00:00:00Z')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = BASE_URL

  const staticPages: MetadataRoute.Sitemap = STATIC_PAGES.map((entry) => ({
    // home は canonical でトレイリングスラッシュを付けない (`${baseUrl}`)。
    url: entry.path === '/' ? baseUrl : `${baseUrl}${entry.path}`,
    lastModified: STATIC_PAGES_LAST_MODIFIED,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))

  // DB 未接続環境 (Docker build 等) では reference / dynamic ページの fetch を省略し、
  // 静的部分のみ返す。実 runtime では DB に常時接続できる前提のため影響なし。
  if (shouldSkipBuildTimeDbAccess()) {
    return staticPages
  }

  // ROUTE_BONSAI は PROTECTED_PATHS に含まれる認証必須 route のため sitemap には
  // 出力しない (Search Console 上で blocked / soft 404 が増えるのを防ぐ)。
  // 将来的に公開盆栽プロフィールを出す場合は別 route (例: /public-bonsai/[id]) を
  // 用意し、その route を sitemap に追加する。
  const [
    users,
    posts,
    shops,
    events,
    terms,
    pesticides,
    diseasePests,
    pesticideColumns,
    activeIngredients,
    spreaderTypes,
    fertilizerColumns,
    fertilizerNutrients,
    treeSpecies,
    hormoneTypes,
    hormoneColumns,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { isPublic: true, isSuspended: false, email: { not: GUEST_EMAIL } },
      select: { id: true, updatedAt: true },
      take: SITEMAP_USERS_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.post.findMany({
      // 非公開ユーザー / 停止ユーザー / 隠し投稿 / リポストを除外し、detail page の公開条件と一致させる。
      where: {
        user: { isPublic: true, isSuspended: false },
        repostPostId: null,
        isHidden: false,
      },
      select: { id: true, createdAt: true },
      take: SITEMAP_POSTS_LIMIT,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.bonsaiShop.findMany({
      where: { isHidden: false },
      select: { id: true, updatedAt: true },
      take: SITEMAP_SHOPS_LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.event.findMany({
      where: {
        isHidden: false,
        OR: [
          { endDate: { gte: new Date() } },
          { endDate: null, startDate: { gte: new Date() } },
        ],
      },
      select: { id: true, createdAt: true },
      take: SITEMAP_EVENTS_LIMIT,
      orderBy: { startDate: 'asc' },
    }),
    prisma.bonsaiTerm.findMany({
      select: { slug: true },
      take: SITEMAP_DICTIONARY_LIMIT,
    }),
    prisma.pesticide.findMany({
      select: { slug: true },
      take: SITEMAP_PESTICIDES_LIMIT,
    }),
    prisma.diseasePest.findMany({
      select: { slug: true },
      take: SITEMAP_DISEASE_PESTS_LIMIT,
    }),
    prisma.pesticideColumn.findMany({
      select: { slug: true },
      take: SITEMAP_PESTICIDE_COLUMNS_LIMIT,
    }),
    prisma.activeIngredient.findMany({
      select: { slug: true },
      take: SITEMAP_ACTIVE_INGREDIENTS_LIMIT,
    }),
    prisma.spreaderType.findMany({
      select: { slug: true },
      take: SITEMAP_SPREADER_TYPES_LIMIT,
    }),
    prisma.fertilizerColumn.findMany({
      select: { slug: true },
      take: SITEMAP_FERTILIZER_COLUMNS_LIMIT,
    }),
    prisma.fertilizerNutrient.findMany({
      select: { slug: true },
      take: SITEMAP_FERTILIZER_NUTRIENTS_LIMIT,
    }),
    prisma.treeSpecies.findMany({
      select: { slug: true },
      take: SITEMAP_TREE_SPECIES_LIMIT,
    }),
    prisma.hormoneType.findMany({
      select: { slug: true },
      take: SITEMAP_HORMONE_TYPES_LIMIT,
    }),
    prisma.hormoneColumn.findMany({
      select: { slug: true },
      take: SITEMAP_HORMONE_COLUMNS_LIMIT,
    }),
  ])

  const userPages: MetadataRoute.Sitemap = users.map((user: typeof users[number]) => ({
    url: `${baseUrl}/users/${user.id}`,
    lastModified: user.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const postPages: MetadataRoute.Sitemap = posts.map((post: typeof posts[number]) => ({
    url: `${baseUrl}/posts/${post.id}`,
    lastModified: post.createdAt,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  const shopPages: MetadataRoute.Sitemap = shops.map((shop: typeof shops[number]) => ({
    url: `${baseUrl}/shops/${shop.id}`,
    lastModified: shop.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const eventPages: MetadataRoute.Sitemap = events.map((event: typeof events[number]) => ({
    url: `${baseUrl}/events/${event.id}`,
    lastModified: event.createdAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const referencePages: MetadataRoute.Sitemap = [
    ...terms.map((term: typeof terms[number]) => ({
      url: `${baseUrl}${ROUTE_DICTIONARY}/${term.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...pesticides.map((p: typeof pesticides[number]) => ({
      url: `${baseUrl}${ROUTE_PESTICIDES}/products/${p.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...diseasePests.map((dp: typeof diseasePests[number]) => ({
      url: `${baseUrl}${ROUTE_PESTICIDES_DISEASES_PESTS}/${dp.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...pesticideColumns.map((c: typeof pesticideColumns[number]) => ({
      url: `${baseUrl}${ROUTE_PESTICIDES_COLUMNS}/${c.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...activeIngredients.map((i: typeof activeIngredients[number]) => ({
      url: `${baseUrl}${ROUTE_PESTICIDES_INGREDIENTS}/${i.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...spreaderTypes.map((s: typeof spreaderTypes[number]) => ({
      url: `${baseUrl}${ROUTE_PESTICIDES_SPREADERS}/${s.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...fertilizerColumns.map((c: typeof fertilizerColumns[number]) => ({
      url: `${baseUrl}${ROUTE_FERTILIZERS_COLUMNS}/${c.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...fertilizerNutrients.map((n: typeof fertilizerNutrients[number]) => ({
      url: `${baseUrl}${ROUTE_FERTILIZERS_NUTRIENTS}/${n.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...treeSpecies.map((t: typeof treeSpecies[number]) => ({
      url: `${baseUrl}${ROUTE_FERTILIZERS_SCHEDULES}/${t.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...hormoneTypes.map((h: typeof hormoneTypes[number]) => ({
      url: `${baseUrl}${ROUTE_HORMONES}/${h.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
    ...hormoneColumns.map((c: typeof hormoneColumns[number]) => ({
      url: `${baseUrl}${ROUTE_HORMONE_COLUMNS}/${c.slug}`,
      changeFrequency: REFERENCE_CHANGE_FREQUENCY,
      priority: REFERENCE_PRIORITY,
    })),
  ]

  return [
    ...staticPages,
    ...userPages,
    ...postPages,
    ...shopPages,
    ...eventPages,
    ...referencePages,
  ]
}
