'use server'

import { z } from 'zod'
import type { ContactStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { sendEmail } from '@/lib/email'
import { renderEmailShell, renderCard, EMAIL_BRAND } from '@/lib/email/templates/shared'
import logger from '@/lib/logger'
import {
  DEFAULT_PAGE_LIMIT,
  MIN_CONTACT_MESSAGE_LENGTH,
  MAX_CONTACT_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SUBJECT_LENGTH,
  CONTACT_RESPONSE_MIN_DAYS,
  CONTACT_RESPONSE_MAX_DAYS,
  CONTACT_STATS_CACHE_REVALIDATE_SECONDS,
} from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError, getClientIp } from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { ROUTE_ADMIN_CONTACT } from '@/lib/constants/routes'
import { buildAdminContactPath } from '@/lib/constants/path-builders'
import {
  ERR_CONTACT_RATE_LIMIT,
  ERR_CONTACT_SEND_FAILED,
  ERR_CONTACT_NOT_FOUND,
  ERR_INVALID_STATUS,
  ERR_CONTACT_NAME_REQUIRED,
  ERR_CONTACT_NAME_TOO_LONG,
  ERR_CONTACT_EMAIL_REQUIRED,
  ERR_CONTACT_EMAIL_INVALID,
  ERR_CONTACT_CATEGORY_REQUIRED,
  ERR_CONTACT_SUBJECT_REQUIRED,
  ERR_CONTACT_SUBJECT_TOO_LONG,
  ERR_CONTACT_MESSAGE_TOO_SHORT,
  ERR_CONTACT_MESSAGE_TOO_LONG,
} from '@/lib/constants/errors'
import { getAppUrl, getAdminEmail } from '@/lib/env'
import { escapeHtml } from '@/lib/sanitize'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { CONTACT_STATUS } from '@/lib/constants/status'
import { CONTACT_CATEGORY_VALUES, CONTACT_CATEGORY_LABELS } from '@/lib/constants/contact-categories'

const VALID_STATUSES: readonly string[] = Object.values(CONTACT_STATUS)

/**
 * 外部入力の文字列を Prisma の ContactStatus enum に安全に絞り込む。
 * `includes` だけでは TypeScript が string のまま扱うため、type predicate で narrowing する。
 */
function isContactStatus(value: string): value is ContactStatus {
  return VALID_STATUSES.includes(value)
}

const submitContactSchema = z.object({
  name: z
    .string()
    .min(1, ERR_CONTACT_NAME_REQUIRED)
    .max(MAX_NAME_LENGTH, ERR_CONTACT_NAME_TOO_LONG(MAX_NAME_LENGTH)),
  email: z
    .string()
    .min(1, ERR_CONTACT_EMAIL_REQUIRED)
    .email(ERR_CONTACT_EMAIL_INVALID),
  category: z
    .string()
    .refine((v) => (CONTACT_CATEGORY_VALUES as readonly string[]).includes(v), {
      message: ERR_CONTACT_CATEGORY_REQUIRED,
    }),
  subject: z
    .string()
    .min(1, ERR_CONTACT_SUBJECT_REQUIRED)
    .max(MAX_SUBJECT_LENGTH, ERR_CONTACT_SUBJECT_TOO_LONG(MAX_SUBJECT_LENGTH)),
  message: z
    .string()
    .min(MIN_CONTACT_MESSAGE_LENGTH, ERR_CONTACT_MESSAGE_TOO_SHORT(MIN_CONTACT_MESSAGE_LENGTH))
    .max(MAX_CONTACT_MESSAGE_LENGTH, ERR_CONTACT_MESSAGE_TOO_LONG(MAX_CONTACT_MESSAGE_LENGTH)),
})

export async function submitContactInquiry(data: {
  name: string
  email: string
  category: string
  subject: string
  message: string
}) {
  try {
    // 公開APIなので認証はなし。Zod バリデーションを最初に行い、無効入力で
    // レート制限カウンタやDBを無駄に消費しないようにする。
    const parsed = submitContactSchema.safeParse({
      name: data.name?.trim(),
      email: data.email?.trim(),
      category: data.category,
      subject: data.subject?.trim(),
      message: data.message?.trim(),
    })
    if (!parsed.success) {
      return actionZodError(parsed.error)
    }
    const { name, email, category, subject, message } = parsed.data

    // スパム対策: IPベースのレート制限は Zod の後に実行する。
    const ip = await getClientIp()
    const rateLimitResult = await rateLimit(`contact:${ip}`, RATE_LIMITS.contact)
    if (!rateLimitResult.success) {
      return actionError(ERR_CONTACT_RATE_LIMIT)
    }

    const inquiry = await prisma.contactInquiry.create({
      data: {
        name,
        email,
        category,
        subject,
        message,
      },
    })

    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safeSubject = escapeHtml(subject)
    const safeMessage = escapeHtml(message)
    const safeCategoryLabel = escapeHtml(CONTACT_CATEGORY_LABELS[category] ?? category)

    // 送信者へ確認メール
    const appUrl = getAppUrl()
    await sendEmail({
      to: email,
      subject: '【BON-LOG】お問い合わせを受け付けました',
      html: renderEmailShell(
        'お問い合わせ確認',
        renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; font-size: 20px; margin-top: 0;">お問い合わせを受け付けました</h2>
    <p>${safeName} 様</p>
    <p>以下の内容でお問い合わせを受け付けました。</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>カテゴリ:</strong> ${safeCategoryLabel}</p>
      <p style="margin: 5px 0;"><strong>件名:</strong> ${safeSubject}</p>
    </div>
    <p>回答まで${CONTACT_RESPONSE_MIN_DAYS}〜${CONTACT_RESPONSE_MAX_DAYS}営業日程度お時間をいただく場合がございます。</p>`)
      ),
      text: `${name} 様\n\nお問い合わせを受け付けました。\nカテゴリ: ${CONTACT_CATEGORY_LABELS[category] ?? category}\n件名: ${subject}\n\n回答まで${CONTACT_RESPONSE_MIN_DAYS}〜${CONTACT_RESPONSE_MAX_DAYS}営業日程度お時間をいただく場合がございます。`,
    })

    // 管理者へ通知メール
    const adminEmail = getAdminEmail()
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `【BON-LOG管理】新規お問い合わせ: ${subject}`,
        html: renderEmailShell(
          '新規お問い合わせ',
          renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; font-size: 20px; margin-top: 0;">新規お問い合わせ</h2>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>名前:</strong> ${safeName}</p>
      <p style="margin: 5px 0;"><strong>メール:</strong> ${safeEmail}</p>
      <p style="margin: 5px 0;"><strong>カテゴリ:</strong> ${safeCategoryLabel}</p>
      <p style="margin: 5px 0;"><strong>件名:</strong> ${safeSubject}</p>
      <p style="margin: 5px 0;"><strong>内容:</strong></p>
      <p style="white-space: pre-wrap;">${safeMessage}</p>
    </div>
    <p><a href="${appUrl}${buildAdminContactPath(inquiry.id)}" style="color: ${EMAIL_BRAND.primary};">管理画面で確認する</a></p>`)
        ),
        text: `新規お問い合わせ\n\n名前: ${name}\nメール: ${email}\nカテゴリ: ${CONTACT_CATEGORY_LABELS[category] ?? category}\n件名: ${subject}\n\n${message}`,
      })
    }

    return actionSuccess()
  } catch (error) {
    logger.error('Contact inquiry submission failed:', error)
    return actionError(ERR_CONTACT_SEND_FAILED)
  }
}

export async function getContactInquiries(options: {
  status?: string
  search?: string
  cursor?: string
  limit?: number
} = {}) {
  const admin = await requireAdmin('contacts:view')
  if ('error' in admin) return actionError(admin.error)

  const { status, search, cursor, limit = DEFAULT_PAGE_LIMIT } = options

  const where: Prisma.ContactInquiryWhereInput = {}
  if (status && isContactStatus(status)) {
    where.status = status
  }
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [inquiries, total] = await Promise.all([
    prisma.contactInquiry.findMany({
      where,
      // createdAt 同値時の順序を安定させるため id を第二キーに置く
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorPagination(cursor, limit),
    }),
    prisma.contactInquiry.count({ where }),
  ])

  const nextCursor = inquiries.length === limit ? inquiries[inquiries.length - 1]?.id : undefined
  return actionSuccess({ inquiries, total, nextCursor })
}

const getContactStatsCached = unstable_cache(
  async () => {
    const [pending, inProgress, resolved, closed] = await Promise.all([
      prisma.contactInquiry.count({ where: { status: CONTACT_STATUS.PENDING } }),
      prisma.contactInquiry.count({ where: { status: CONTACT_STATUS.IN_PROGRESS } }),
      prisma.contactInquiry.count({ where: { status: CONTACT_STATUS.RESOLVED } }),
      prisma.contactInquiry.count({ where: { status: CONTACT_STATUS.CLOSED } }),
    ])
    return { pending, inProgress, resolved, closed, total: pending + inProgress + resolved + closed }
  },
  ['contact-stats'],
  { tags: ['contact-inquiries'], revalidate: CONTACT_STATS_CACHE_REVALIDATE_SECONDS }
)

export async function getContactStats() {
  const admin = await requireAdmin('contacts:view')
  if ('error' in admin) return actionError(admin.error)

  const stats = await getContactStatsCached()
  return actionSuccess(stats)
}

export async function getContactInquiry(id: string) {
  const admin = await requireAdmin('contacts:view')
  if ('error' in admin) return actionError(admin.error)

  const inquiry = await prisma.contactInquiry.findUnique({ where: { id } })
  if (!inquiry) return actionError(ERR_CONTACT_NOT_FOUND)

  return actionSuccess({ inquiry })
}

export async function updateInquiryStatus(
  id: string,
  status: string,
  adminNote?: string
) {
  const admin = await requireAdmin('contacts:respond')
  if ('error' in admin) return actionError(admin.error)
  const userId = admin.userId

  if (!VALID_STATUSES.includes(status)) {
    return actionError(ERR_INVALID_STATUS)
  }

  const inquiry = await prisma.contactInquiry.findUnique({ where: { id } })
  if (!inquiry) return actionError(ERR_CONTACT_NOT_FOUND)

  const updateData: Record<string, unknown> = { status }
  if (adminNote !== undefined) {
    updateData.adminNote = adminNote
  }
  if (status === CONTACT_STATUS.RESOLVED || status === CONTACT_STATUS.CLOSED) {
    updateData.respondedAt = new Date()
  }

  await prisma.contactInquiry.update({ where: { id }, data: updateData })

  await prisma.adminLog.create({
    data: {
      adminId: userId,
      action: 'update_contact_status',
      targetType: 'contact_inquiry',
      targetId: id,
      details: { status, adminNote: adminNote || null },
    },
  })

  revalidatePath(ROUTE_ADMIN_CONTACT)
  revalidatePath(`/admin/contact/${id}`)
  revalidateTag('contact-inquiries', 'max')
  revalidateTag(`contact-inquiry-${id}`, 'max')
  return actionSuccess()
}

export async function deleteInquiry(id: string) {
  const admin = await requireAdmin('contacts:respond')
  if ('error' in admin) return actionError(admin.error)
  const userId = admin.userId

  const inquiry = await prisma.contactInquiry.findUnique({ where: { id } })
  if (!inquiry) return actionError(ERR_CONTACT_NOT_FOUND)

  await prisma.contactInquiry.delete({ where: { id } })

  await prisma.adminLog.create({
    data: {
      adminId: userId,
      action: 'delete_contact_inquiry',
      targetType: 'contact_inquiry',
      targetId: id,
      details: { subject: inquiry.subject, email: inquiry.email },
    },
  })

  revalidatePath(ROUTE_ADMIN_CONTACT)
  revalidateTag('contact-inquiries', 'max')
  return actionSuccess()
}
