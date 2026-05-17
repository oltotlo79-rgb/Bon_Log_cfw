'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getPrefecturesByRegion, isRegionName } from '@/lib/prefectures'
import { UPCOMING_EVENTS_LIMIT, MAX_EVENT_TITLE_LENGTH, MAX_EVENTS_LIMIT } from '@/lib/constants/limits'
import {
  ERR_EVENT_NOT_FOUND,
  ERR_PERMISSION_DENIED,
  ERR_EDIT_PERMISSION_DENIED,
  ERR_INVALID_START_DATE,
  ERR_INVALID_END_DATE,
  ERR_END_BEFORE_START,
  ERR_OPERATION_FAILED,
  ERR_EVENT_TITLE_REQUIRED,
  ERR_EVENT_START_DATE_REQUIRED,
  ERR_EVENT_PREFECTURE_REQUIRED,
} from '@/lib/constants/errors'
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize'
import logger from '@/lib/logger'
import { requireActiveNonGuestUser, actionSuccess, actionError, type ActionResult, enforceUserRateLimit } from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import { getStartOfToday } from '@/lib/utils'
import { ROUTE_EVENTS } from '@/lib/constants/routes'
import { buildEventPath } from '@/lib/constants/path-builders'

const eventSchema = z.object({
  title: z.string().min(1, ERR_EVENT_TITLE_REQUIRED).max(MAX_EVENT_TITLE_LENGTH),
  startDate: z.string().min(1, ERR_EVENT_START_DATE_REQUIRED),
  endDate: z.string().nullable().optional(),
  prefecture: z.string().min(1, ERR_EVENT_PREFECTURE_REQUIRED),
  city: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  organizer: z.string().nullable().optional(),
  fee: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  externalUrl: z.string().nullable().optional(),
})

/**
 * イベントフォームデータを解析・バリデーションする。
 * createEvent と updateEvent で共通利用。
 */
function parseEventFormData(formData: FormData) {
  const hasSales = formData.get('hasSales') === 'true'

  const parsed = eventSchema.safeParse({
    title: formData.get('title') || '',
    startDate: formData.get('startDate') || '',
    endDate: formData.get('endDate') || null,
    prefecture: formData.get('prefecture') || '',
    city: formData.get('city') || null,
    venue: formData.get('venue') || null,
    organizer: formData.get('organizer') || null,
    fee: formData.get('fee') || null,
    description: formData.get('description') || null,
    externalUrl: formData.get('externalUrl') || null,
  })

  if (!parsed.success) {
    return actionZodError(parsed.error)
  }

  const { title, startDate: startDateStr, endDate: endDateStr, prefecture, city, venue, organizer, fee, description, externalUrl } = parsed.data

  const startDate = new Date(startDateStr)
  if (isNaN(startDate.getTime())) {
    return actionError(ERR_INVALID_START_DATE)
  }

  const endDate = endDateStr ? new Date(endDateStr) : null
  if (endDate && isNaN(endDate.getTime())) {
    return actionError(ERR_INVALID_END_DATE)
  }

  if (endDate && endDate < startDate) {
    return actionError(ERR_END_BEFORE_START)
  }

  return {
    data: {
      title: sanitizeText(title.trim()),
      startDate,
      endDate,
      prefecture,
      city: city ? sanitizeText(city.trim()) : null,
      venue: venue ? sanitizeText(venue.trim()) : null,
      organizer: organizer ? sanitizeText(organizer.trim()) : null,
      admissionFee: fee ? sanitizeText(fee.trim()) : null,
      hasSales,
      description: description ? sanitizeText(description.trim()) : null,
      externalUrl: externalUrl ? sanitizeUrl(externalUrl.trim()) : null,
    },
  }
}

/** イベント一覧をフィルター条件付きで取得する。 */
export async function getEvents(options?: {
  region?: string
  prefecture?: string
  showPast?: boolean
  month?: number
  year?: number
}) {
  try {
    const { region, prefecture, showPast = false, month, year } = options || {}
    const today = getStartOfToday()

    let prefectureFilter: string[] | undefined
    if (prefecture) {
      prefectureFilter = [prefecture]
    } else if (region && isRegionName(region)) {
      prefectureFilter = getPrefecturesByRegion(region)
    }

    let dateFilter: { gte?: Date; lt?: Date } | undefined
    if (month !== undefined && year !== undefined) {
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 1)
      dateFilter = {
        gte: startOfMonth,
        lt: endOfMonth,
      }
    } else if (!showPast) {
      dateFilter = { gte: today }
    }

    const events = await prisma.event.findMany({
      where: {
        isHidden: false,
        ...(dateFilter && { startDate: dateFilter }),
        ...(prefectureFilter && { prefecture: { in: prefectureFilter } }),
      },
      include: {
        creator: {
          select: USER_MINIMAL_SELECT,
        },
      },
      orderBy: { startDate: 'asc' },
      take: MAX_EVENTS_LIMIT,
    })

    return { events }
  } catch (error) {
    logger.error('getEvents failed', { error: error instanceof Error ? error.message : String(error) })
    return { events: [] }
  }
}

/** 今日以降のイベントを取得する（サイドバー・トップページ用）。 */
export async function getUpcomingEvents(limit = UPCOMING_EVENTS_LIMIT, region?: string) {
  try {
    const today = getStartOfToday()
    const prefectures = region && isRegionName(region) ? getPrefecturesByRegion(region) : undefined

    const events = await prisma.event.findMany({
      where: {
        isHidden: false,
        startDate: { gte: today },
        ...(prefectures && { prefecture: { in: prefectures } }),
      },
      include: {
        creator: {
          select: USER_MINIMAL_SELECT,
        },
      },
      orderBy: { startDate: 'asc' },
      take: limit,
    })

    return { events }
  } catch (error) {
    logger.error('getUpcomingEvents failed', { error: error instanceof Error ? error.message : String(error) })
    return { events: [] }
  }
}

/** 月別イベントを取得する（カレンダー用）。月をまたぐイベントにも対応。 */
export async function getEventsByMonth(year: number, month: number) {
  try {
    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 1)

    const events = await prisma.event.findMany({
      where: {
        isHidden: false,
        OR: [
          {
            startDate: {
              gte: startOfMonth,
              lt: endOfMonth,
            },
          },
          {
            endDate: {
              gte: startOfMonth,
              lt: endOfMonth,
            },
          },
          {
            startDate: { lt: startOfMonth },
            endDate: { gte: endOfMonth },
          },
        ],
      },
      include: {
        creator: {
          select: USER_MINIMAL_SELECT,
        },
      },
      orderBy: { startDate: 'asc' },
      take: MAX_EVENTS_LIMIT,
    })

    return { events }
  } catch (error) {
    logger.error('getEventsByMonth failed', { error: error instanceof Error ? error.message : String(error) })
    return { events: [] }
  }
}

type EventDetailRecord = NonNullable<Awaited<ReturnType<typeof loadEventForDetail>>>

/** イベント詳細を取得する。`ActionResult<{ event }>` 形式で `result.success` 分岐させる。 */
export async function getEvent(
  eventId: string,
): Promise<ActionResult<{ event: EventDetailRecord & { isOwner: boolean } }>> {
  // 認可は detail ページ自体に置く設計 (公開 event は誰でも閲覧可)。getEvent では
  // current session を覗いて isOwner を埋めるだけ。
  const session = await auth()
  const currentUserId = session?.user?.id

  const event = await loadEventForDetail(eventId)

  if (!event) {
    return actionError(ERR_EVENT_NOT_FOUND)
  }

  return actionSuccess({
    event: {
      ...event,
      isOwner: currentUserId === event.createdBy,
    },
  })
}

async function loadEventForDetail(eventId: string) {
  return prisma.event.findUnique({
    where: {
      id: eventId,
      isHidden: false,
    },
    include: {
      creator: {
        select: USER_MINIMAL_SELECT,
      },
    },
  })
}

/** 新しいイベントを作成する。 */
export async function createEvent(formData: FormData): Promise<ActionResult<{ eventId: string }>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = parseEventFormData(formData)
  if ('error' in parsed) {
    return actionError(parsed.error)
  }

  const rl = await enforceUserRateLimit(userId, 'create_event')
  if (rl) return actionError(rl.error)

  try {
    const event = await prisma.event.create({
      data: {
        createdBy: userId,
        ...parsed.data,
      },
    })

    revalidatePath(ROUTE_EVENTS)

    return actionSuccess({ eventId: event.id })
  } catch (error) {
    logger.error('createEvent failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/** 既存のイベントを更新する。作成者のみ実行可能。 */
export async function updateEvent(eventId: string, formData: FormData): Promise<ActionResult<void>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = parseEventFormData(formData)
  if ('error' in parsed) {
    return actionError(parsed.error)
  }

  const rl = await enforceUserRateLimit(userId, 'update_event')
  if (rl) return actionError(rl.error)

  try {
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: { createdBy: true },
    })

    if (!existingEvent) {
      return actionError(ERR_EVENT_NOT_FOUND)
    }

    if (existingEvent.createdBy !== userId) {
      return actionError(ERR_EDIT_PERMISSION_DENIED)
    }

    await prisma.event.update({
      where: { id: eventId },
      data: parsed.data,
    })

    revalidatePath(ROUTE_EVENTS)
    revalidatePath(buildEventPath(eventId))

    return actionSuccess()
  } catch (error) {
    logger.error('updateEvent failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

/** イベントを削除する。作成者のみ実行可能。 */
export async function deleteEvent(eventId: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rl = await enforceUserRateLimit(userId, 'delete_event')
  if (rl) return actionError(rl.error)

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdBy: true },
  })

  if (!event) {
    return actionError(ERR_EVENT_NOT_FOUND)
  }

  if (event.createdBy !== userId) {
    return actionError(ERR_PERMISSION_DENIED)
  }

  await prisma.event.delete({
    where: { id: eventId },
  })

  revalidatePath(ROUTE_EVENTS)

  return actionSuccess()
}
