/**
 * @module lib/actions/pesticide
 *
 * 農薬・病害虫・有効成分・剤型などの読み取り専用 query を提供する。
 * RSC からの直接 await 用途のため `'use server'` ではなく `server-only` モジュールとし、
 * 公開 RPC 面を持たない。Client から呼ぶ必要ができた場合は別途 Server Action を切り出す。
 *
 * 認証なしで参照可能（公開 SEO ページ）。sitemap に列挙され未ログイン/crawler が入口にするため、
 * requireAuth を付けると soft 404 / 空表示になる。入力は Zod、件数は上限定数で保護する。
 */
import 'server-only'

import { z } from 'zod'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'
import { DiseasePestCategory, type Prisma } from '@prisma/client'
import { normalizePesticideType } from '@/lib/utils/pesticide'
import { CACHE_TAGS } from '@/lib/cache'
import { MAX_SEARCH_QUERY_LENGTH, MAX_PESTICIDE_LIST_LIMIT, MAX_SLUG_LENGTH, CACHE_TTL_PESTICIDE_MASTER } from '@/lib/constants/limits'

// ── 入力スキーマ ──────────────────────────────────────────────────
const slugSchema = z.string().min(1).max(MAX_SLUG_LENGTH)
const searchSchema = z.string().max(MAX_SEARCH_QUERY_LENGTH)
const diseasePestCategorySchema = z.nativeEnum(DiseasePestCategory)
// 剤型コードや type はホワイトリスト外でも `findUnique` で safely null を返すが、
// 極端な長文を DB に投げないよう上限を設ける
const codeSchema = z.string().min(1).max(MAX_SLUG_LENGTH)
// 体長は非負の有限数値のみ受け付ける
const bodySizeMmSchema = z.number().finite().nonnegative()

/**
 * `getDiseasePests` のクエリパラメータスキーマ。
 *
 * 入力検証は 1 つの schema に集約することで、各フィールドの検証順や失敗時の
 * 戻り値（空配列）を統一する。`search` は `MAX_SEARCH_QUERY_LENGTH` で先に
 * 切り詰めてから validate し、空文字なら `undefined` に正規化する
 * （後段の `if (search)` 条件分岐を素直に書けるようにするため）。
 */
const diseasePestQuerySchema = z.object({
  category: diseasePestCategorySchema.optional(),
  search: searchSchema
    .transform((s) => s.slice(0, MAX_SEARCH_QUERY_LENGTH))
    .transform((s) => (s.length > 0 ? s : undefined))
    .optional(),
  bodySizeMm: bodySizeMmSchema.optional(),
})

/**
 * DB の imageUrl が未設定の9種に対して、public/images/pesticides/ の画像をフォールバック適用する。
 * ファイルはリポジトリに同梱済み。DB 更新が完了次第この Map は削除可能。
 */
const PEST_IMAGE_FALLBACK: Record<string, string> = {
  'kabura-habachi': '/images/pesticides/kabura-habachi.png',
  'kinuwaba': '/images/pesticides/kinuwaba.png',
  'koumorigiga': '/images/pesticides/koumorigiga.png',
  'kubiaka-tsuyakamikiri': '/images/pesticides/kubiaka-tsuyakamikiri.png',
  'mikan-hamorigiga': '/images/pesticides/mikan-hamorigiga.png',
  'minami-kiiro-azamiuma': '/images/pesticides/minami-kiiro-azamiuma.png',
  'oonijyuuya-hoshitentou': '/images/pesticides/oonijyuuya-hoshitentou.png',
  'ringo-kokaku-hamaki': '/images/pesticides/ringo-kokaku-hamaki.png',
  'tamana-yaga': '/images/pesticides/tamana-yaga.png',
}

function applyImageFallback<T extends { slug: string; imageUrl: string | null }>(item: T): T {
  if (item.imageUrl) return item
  const fallback = PEST_IMAGE_FALLBACK[item.slug]
  return fallback ? { ...item, imageUrl: fallback } : item
}

// ── 病害虫 ────────────────────────────────────────────────────────

export async function getDiseasePests(params?: {
  category?: 'disease' | 'pest' | 'beneficial_insect'
  search?: string
  bodySizeMm?: number // 体長（mm）で害虫・益虫を絞り込む
}) {
  if (shouldSkipBuildTimeDbAccess()) return { diseasePests: [] }

  // 入力を Zod で境界検証（不正値はフィルタ不適用の全件扱いではなく空配列で早期 return）
  const parsed = diseasePestQuerySchema.safeParse(params ?? {})
  if (!parsed.success) return { diseasePests: [] }
  const { category, search, bodySizeMm } = parsed.data

  const where: Prisma.DiseasePestWhereInput = {}

  if (category) {
    where.category = category
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameKana: { contains: search, mode: 'insensitive' } },
      // 体長（mm/cm）・色（赤・緑・黒など）で検索可能
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  // 体長（mm）で害虫・益虫を絞り込む（入力値がmin〜maxの範囲内を抽出）
  if (bodySizeMm !== undefined && bodySizeMm > 0) {
    where.bodySizeMinMm = { lte: bodySizeMm }
    where.bodySizeMaxMm = { gte: bodySizeMm }
    where.category = { in: ['pest', 'beneficial_insect'] } // 体長検索は害虫・益虫のみ
  }

  const diseasePests = await prisma.diseasePest.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { effects: true } },
    },
    take: MAX_PESTICIDE_LIST_LIMIT,
  })

  return { diseasePests: diseasePests.map(applyImageFallback) }
}

export async function getDiseasePestBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  const dp = await prisma.diseasePest.findUnique({
    where: { slug: parsed.data },
    include: {
      effects: {
        select: {
          preventionLevel: true,
          treatmentLevel: true,
          efficacyLevel: true,
          persistenceLevel: true,
          pesticide: {
            select: {
              id: true,
              name: true,
              slug: true,
              registrationNumber: true,
              pesticideType: true,
              formulationType: {
                select: { name: true },
              },
              ingredients: {
                select: {
                  activeIngredient: {
                    select: { name: true, fracCode: true, iracCode: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { pesticide: { name: 'asc' } },
      },
    },
  })
  return dp ? applyImageFallback(dp) : null
}

// ── 薬剤 ──────────────────────────────────────────────────────────

export async function getPesticides(params?: {
  search?: string
  type?: string
  diseasePestId?: string
  formulationTypeCode?: string
}) {
  if (shouldSkipBuildTimeDbAccess()) return { pesticides: [] }

  // 全パラメータを Zod で境界検証
  let search: string | undefined
  if (params?.search !== undefined) {
    const parsed = searchSchema.safeParse(params.search.slice(0, MAX_SEARCH_QUERY_LENGTH))
    if (!parsed.success) return { pesticides: [] }
    search = parsed.data || undefined
  }

  let diseasePestId: string | undefined
  if (params?.diseasePestId !== undefined) {
    const parsed = slugSchema.safeParse(params.diseasePestId)
    if (!parsed.success) return { pesticides: [] }
    diseasePestId = parsed.data
  }

  let formulationTypeCode: string | undefined
  if (params?.formulationTypeCode !== undefined) {
    const parsed = codeSchema.safeParse(params.formulationTypeCode)
    if (!parsed.success) return { pesticides: [] }
    formulationTypeCode = parsed.data
  }

  const where: Prisma.PesticideWhereInput = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { registrationNumber: { contains: search, mode: 'insensitive' } },
    ]
  }
  const pesticideType = normalizePesticideType(params?.type)
  if (pesticideType) {
    where.pesticideType = pesticideType
  }
  if (diseasePestId) {
    where.effects = { some: { diseasePestId } }
  }
  if (formulationTypeCode) {
    where.formulationType = { is: { code: formulationTypeCode } }
  }

  const pesticides = await prisma.pesticide.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      // 一覧表示で必要なフィールドのみ select して転送量を削減
      formulationType: { select: { name: true } },
      ingredients: {
        select: {
          contentLabel: true,
          activeIngredient: {
            select: { name: true, fracCode: true, iracCode: true },
          },
        },
      },
      effects: {
        select: {
          diseasePestId: true,
          preventionLevel: true,
          treatmentLevel: true,
          efficacyLevel: true,
          persistenceLevel: true,
          diseasePest: {
            select: { name: true, category: true },
          },
        },
      },
    },
    take: MAX_PESTICIDE_LIST_LIMIT,
  })

  return { pesticides }
}

export async function getPesticideBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.pesticide.findUnique({
    where: { slug: parsed.data },
    select: {
      id: true,
      name: true,
      slug: true,
      pesticideType: true,
      description: true,
      registrationNumber: true,
      formulationType: {
        select: { name: true, code: true },
      },
      ingredients: {
        select: {
          contentLabel: true,
          activeIngredient: {
            select: { slug: true, name: true, fracCode: true, iracCode: true, resistanceRisk: true },
          },
        },
      },
      effects: {
        select: {
          id: true,
          preventionLevel: true,
          treatmentLevel: true,
          efficacyLevel: true,
          persistenceLevel: true,
          diseasePest: {
            select: { slug: true, name: true, category: true },
          },
        },
        orderBy: { diseasePest: { name: 'asc' } },
      },
      incompatibleWith: {
        select: {
          incompatibleWithId: true,
          incompatibleWith: {
            select: {
              slug: true,
              name: true,
              formulationType: { select: { name: true } },
            },
          },
        },
        orderBy: { incompatibleWith: { name: 'asc' } },
      },
      spreaderTypes: {
        select: {
          spreaderType: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  })
}

// ── 原体 ──────────────────────────────────────────────────────────

export async function getActiveIngredients(params?: {
  search?: string
}) {
  if (shouldSkipBuildTimeDbAccess()) return { ingredients: [] }

  let search: string | undefined
  if (params?.search !== undefined) {
    const parsed = searchSchema.safeParse(params.search.slice(0, MAX_SEARCH_QUERY_LENGTH))
    if (!parsed.success) return { ingredients: [] }
    search = parsed.data || undefined
  }

  const where: Prisma.ActiveIngredientWhereInput = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameEn: { contains: search, mode: 'insensitive' } },
      { fracCode: { contains: search, mode: 'insensitive' } },
      { iracCode: { contains: search, mode: 'insensitive' } },
    ]
  }

  const ingredients = await prisma.activeIngredient.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { pesticides: true } },
    },
    take: MAX_PESTICIDE_LIST_LIMIT,
  })

  return { ingredients }
}

export async function getActiveIngredientBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.activeIngredient.findUnique({
    where: { slug: parsed.data },
    select: {
      slug: true,
      name: true,
      nameEn: true,
      fracCode: true,
      iracCode: true,
      ingredientGroup: true,
      resistanceRisk: true,
      description: true,
      pesticides: {
        select: {
          contentLabel: true,
          pesticide: {
            select: {
              id: true,
              slug: true,
              name: true,
              formulationType: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  })
}

// ── 展着剤 ────────────────────────────────────────────────────────

const getSpreaderTypesCached = unstable_cache(
  async () => {
    if (shouldSkipBuildTimeDbAccess()) return { spreaders: [] }
    const spreaders = await prisma.spreaderType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        pesticides: {
          include: {
            pesticide: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      take: MAX_PESTICIDE_LIST_LIMIT,
    })

    return { spreaders }
  },
  ['pesticide-spreader-types'],
  { revalidate: CACHE_TTL_PESTICIDE_MASTER, tags: [CACHE_TAGS.PESTICIDE_MASTER] }
)

export async function getSpreaderTypes() {
  return getSpreaderTypesCached()
}

/** 展着剤商材（spreaderTypes を1つ以上持つ薬剤）の一覧。個別ページは /pesticides/products/[slug] */
const getSpreaderProductsCached = unstable_cache(
  async () => {
    if (shouldSkipBuildTimeDbAccess()) return { pesticides: [] }
    const pesticides = await prisma.pesticide.findMany({
      where: { spreaderTypes: { some: {} } },
      orderBy: { name: 'asc' },
      include: {
        formulationType: { select: { name: true } },
        spreaderTypes: {
          include: { spreaderType: true },
        },
      },
      take: MAX_PESTICIDE_LIST_LIMIT,
    })
    return { pesticides }
  },
  ['pesticide-spreader-products'],
  { revalidate: CACHE_TTL_PESTICIDE_MASTER, tags: [CACHE_TAGS.PESTICIDE_MASTER] }
)

export async function getSpreaderProducts() {
  return getSpreaderProductsCached()
}

/**
 * 展着剤タイプの詳細（ページ表示用）。
 * 紐付く薬剤の成分・効果・混用不可情報を含む完全なデータを返す。
 */
export async function getSpreaderTypeBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.spreaderType.findUnique({
    where: { slug: parsed.data },
    include: {
      pesticides: {
        include: {
          pesticide: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              formulationType: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })
}

// ── 混用チェック ─────────────────────────────────────────────────

const getPesticideIncompatibilitiesCached = unstable_cache(
  async () => {
    if (shouldSkipBuildTimeDbAccess()) return { incompatibilities: [] }
    const incompatibilities = await prisma.pesticideIncompatibility.findMany({
      select: {
        pesticideId: true,
        incompatibleWithId: true,
      },
    })

    return { incompatibilities }
  },
  ['pesticide-incompatibilities'],
  { revalidate: CACHE_TTL_PESTICIDE_MASTER, tags: [CACHE_TAGS.PESTICIDE_MASTER] }
)

export async function getPesticideIncompatibilities() {
  return getPesticideIncompatibilitiesCached()
}

const getPesticideOptionsCached = unstable_cache(
  async () => {
    if (shouldSkipBuildTimeDbAccess()) return { pesticides: [] }
    const pesticides = await prisma.pesticide.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        pesticideType: true,
      },
      orderBy: { name: 'asc' },
      take: MAX_PESTICIDE_LIST_LIMIT,
    })

    return { pesticides }
  },
  ['pesticide-options'],
  { revalidate: CACHE_TTL_PESTICIDE_MASTER, tags: [CACHE_TAGS.PESTICIDE_MASTER] }
)

export async function getPesticideOptions() {
  return getPesticideOptionsCached()
}

// ── コラム ────────────────────────────────────────────────────────

function getColumnsCachedImpl(category: string | undefined) {
  return unstable_cache(
    async () => {
      if (shouldSkipBuildTimeDbAccess()) return { columns: [] }
      const where: Prisma.PesticideColumnWhereInput = {
        publishedAt: { not: null },
      }
      if (category) {
        where.category = category
      }

      const columns = await prisma.pesticideColumn.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
        take: MAX_PESTICIDE_LIST_LIMIT,
      })

      return { columns }
    },
    ['pesticide-columns', category ?? 'all'],
    { revalidate: CACHE_TTL_PESTICIDE_MASTER, tags: [CACHE_TAGS.PESTICIDE_MASTER] }
  )
}

export async function getColumns(params?: { category?: string }) {
  let category: string | undefined
  if (params?.category !== undefined) {
    const parsed = codeSchema.safeParse(params.category)
    if (!parsed.success) return { columns: [] }
    category = parsed.data
  }

  return getColumnsCachedImpl(category)()
}

export async function getColumnBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.pesticideColumn.findUnique({ where: { slug: parsed.data } })
}

// ── 剤型 ──────────────────────────────────────────────────────────

const getFormulationTypesCached = unstable_cache(
  async () => {
    if (shouldSkipBuildTimeDbAccess()) return { formulations: [] }
    const formulations = await prisma.formulationType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { pesticides: true } },
      },
      take: MAX_PESTICIDE_LIST_LIMIT,
    })

    return { formulations }
  },
  ['pesticide-formulation-types'],
  { revalidate: CACHE_TTL_PESTICIDE_MASTER, tags: [CACHE_TAGS.PESTICIDE_MASTER] }
)

export async function getFormulationTypes() {
  return getFormulationTypesCached()
}

export async function getFormulationTypeByCode(code: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = codeSchema.safeParse(code)
  if (!parsed.success) return null

  return prisma.formulationType.findUnique({
    where: { code: parsed.data },
  })
}
