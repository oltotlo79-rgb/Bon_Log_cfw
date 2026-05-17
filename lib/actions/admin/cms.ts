'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DEFAULT_PAGE_LIMIT, CMS_VERSION_HISTORY_LIMIT, CMS_SLUG_RESERVED } from '@/lib/constants/limits'
import { ACTION_UPDATE_CMS_PAGE, ACTION_DELETE_CMS_PAGE } from '@/lib/constants/admin-actions'
import { requireAdmin, actionSuccess, actionError } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { ERR_CMS_PAGE_NOT_FOUND, ERR_CMS_SLUG_DUPLICATE, ERR_CMS_SLUG_INVALID_CHARS, ERR_CMS_SLUG_RESERVED, ERR_OPERATION_FAILED, ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTE_ADMIN_CONTENT_MANAGEMENT } from '@/lib/constants/routes'
import { logger } from '@/lib/logger'
import { adminIdSchema, cmsSlugSchema, cmsTitleSchema, cmsContentSchema, cmsCategorySchema } from './_schemas'

const createCmsPageSchema = z.object({
  slug: cmsSlugSchema,
  title: cmsTitleSchema,
  content: cmsContentSchema,
  category: cmsCategorySchema,
})

const updateCmsPageSchema = z.object({
  title: cmsTitleSchema.optional(),
  content: cmsContentSchema.optional(),
  isPublished: z.boolean().optional(),
})

// 既存挙動を維持: get / update / delete は slug pattern を強制しない。
// 該当 slug が DB に存在しなければ通常の `ERR_CMS_PAGE_NOT_FOUND` で弾く。
// 文字列長と非空のみ保護する。
const lookupSlugSchema = adminIdSchema

export async function getCmsPages(options?: {
  category?: string
  search?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('cms:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const { category, search, limit = DEFAULT_PAGE_LIMIT, cursor } = options || {}

    const where = {
      ...(category && { category }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { slug: { contains: search } },
        ],
      }),
    }

    const [pages, total] = await Promise.all([
      prisma.cmsPage.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.cmsPage.count({ where }),
    ])

    const nextCursor = pages.length === limit ? pages[pages.length - 1]?.id : undefined
    return { pages, total, nextCursor }
  } catch (error) {
    logger.error('getCmsPages failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function getCmsPage(slug: string) {
  const admin = await requireAdmin('cms:view')
  if ('error' in admin) return actionError(admin.error)

  const parsed = lookupSlugSchema.safeParse(slug)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const page = await prisma.cmsPage.findUnique({
      where: { slug: parsed.data },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: CMS_VERSION_HISTORY_LIMIT,
        },
      },
    })

    if (!page) return actionError(ERR_CMS_PAGE_NOT_FOUND)
    return { page }
  } catch (error) {
    logger.error('getCmsPage failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function createCmsPage(data: {
  slug: string
  title: string
  content: string
  category: string
}) {
  const admin = await requireAdmin('cms:manage')
  if ('error' in admin) return actionError(admin.error)

  const parsed = createCmsPageSchema.safeParse(data)
  if (!parsed.success) return actionError(ERR_CMS_SLUG_INVALID_CHARS)
  const input = parsed.data

  // slug の予約語チェックは pattern 上は通過するが、ルート衝突を防ぐため別途実施。
  const firstSegment = input.slug.split('/')[0] ?? ''
  if (CMS_SLUG_RESERVED.includes(firstSegment)) {
    return actionError(ERR_CMS_SLUG_RESERVED)
  }

  try {
    const existing = await prisma.cmsPage.findUnique({ where: { slug: input.slug } })
    if (existing) return actionError(ERR_CMS_SLUG_DUPLICATE)

    const page = await prisma.cmsPage.create({
      data: {
        slug: input.slug,
        title: input.title,
        content: input.content,
        category: input.category,
        version: 1,
        createdBy: admin.userId,
      },
    })

    await prisma.cmsPageVersion.create({
      data: {
        pageId: page.id,
        version: 1,
        title: input.title,
        content: input.content,
        createdBy: admin.userId,
      },
    })

    revalidatePath(ROUTE_ADMIN_CONTENT_MANAGEMENT)
    return actionSuccess(page)
  } catch (error) {
    logger.error('createCmsPage failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function updateCmsPage(slug: string, data: {
  title?: string
  content?: string
  isPublished?: boolean
}) {
  const admin = await requireAdmin('cms:manage')
  if ('error' in admin) return actionError(admin.error)

  const slugParsed = lookupSlugSchema.safeParse(slug)
  if (!slugParsed.success) return actionError(ERR_INVALID_INPUT)
  const dataParsed = updateCmsPageSchema.safeParse(data)
  if (!dataParsed.success) return actionError(ERR_INVALID_INPUT)
  const input = dataParsed.data

  try {
    const page = await prisma.cmsPage.findUnique({ where: { slug: slugParsed.data } })
    if (!page) return actionError(ERR_CMS_PAGE_NOT_FOUND)

    const newVersion = page.version + 1
    const shouldPublish = input.isPublished ?? page.isPublished

    await prisma.$transaction([
      prisma.cmsPage.update({
        where: { slug: slugParsed.data },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.content !== undefined && { content: input.content }),
          ...(input.isPublished !== undefined && {
            isPublished: input.isPublished,
            publishedAt: input.isPublished ? new Date() : page.publishedAt,
          }),
          version: newVersion,
        },
      }),
      prisma.cmsPageVersion.create({
        data: {
          pageId: page.id,
          version: newVersion,
          title: input.title || page.title,
          content: input.content ?? page.content,
          createdBy: admin.userId,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_UPDATE_CMS_PAGE,
          targetType: 'cms_page',
          targetId: page.id,
          details: JSON.stringify({ slug: slugParsed.data, version: newVersion, published: shouldPublish }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_CONTENT_MANAGEMENT)
    return actionSuccess()
  } catch (error) {
    logger.error('updateCmsPage failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function deleteCmsPage(slug: string) {
  const admin = await requireAdmin('cms:manage')
  if ('error' in admin) return actionError(admin.error)

  const parsed = lookupSlugSchema.safeParse(slug)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  try {
    const page = await prisma.cmsPage.findUnique({ where: { slug: parsed.data } })
    if (!page) return actionError(ERR_CMS_PAGE_NOT_FOUND)

    await prisma.$transaction([
      prisma.cmsPage.delete({ where: { slug: parsed.data } }),
      prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: ACTION_DELETE_CMS_PAGE,
          targetType: 'cms_page',
          targetId: page.id,
          details: JSON.stringify({ slug: parsed.data, title: page.title }),
        },
      }),
    ])

    revalidatePath(ROUTE_ADMIN_CONTENT_MANAGEMENT)
    return actionSuccess()
  } catch (error) {
    logger.error('deleteCmsPage failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}
