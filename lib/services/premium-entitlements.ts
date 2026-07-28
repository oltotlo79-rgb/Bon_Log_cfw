/**
 * @module lib/services/premium-entitlements
 *
 * Provider (Stripe / RevenueCat) 別 entitlement の適用と、User 側 aggregate
 * （isPremium / premiumExpiresAt）の再計算を行う共有ドメインロジック。
 *
 * 不変条件: `User.isPremium` = 対象 User に現在有効な `PremiumEntitlement` が 1 件以上存在する。
 * 各 provider の webhook / cron はこのモジュール経由でのみ entitlement と aggregate を更新し、
 * 常に同一トランザクション内で両方をコミットする（片方だけの半端な commit を避けるため）。
 *
 * 呼び出し元（webhook route handler / cron route handler）が認証・署名検証・冪等性ガードを
 * 済ませている前提。本モジュール自身は認証を行わない。
 */

import 'server-only'
import { Prisma, type EntitlementProvider, type EntitlementStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'

type TransactionClient = Prisma.TransactionClient
type Db = typeof prisma | TransactionClient

/**
 * Provider entitlement イベントの適用パラメータ。
 *
 * `status` / `providerRef` / `productId` / `cancelAtPeriodEnd` / `expiresAt` は
 * それぞれ「未指定 (undefined) = 既存値を変更しない」という部分更新セマンティクスを持つ。
 * これにより、例えば Stripe の invoice.payment_succeeded（更新のみ・status 不変）と
 * customer.subscription.updated（status も更新）を同じ関数で自然に表現できる。
 *
 * `expiresAt` を明示的に `null` にすると期限をクリアする（未指定の `undefined` とは区別される）。
 */
export interface EntitlementEventInput {
  userId: string
  provider: EntitlementProvider
  /** 未指定 = 既存値を維持。新規作成時の既定値は 'active'。 */
  status?: EntitlementStatus
  /** 未指定 = 既存値を維持。新規作成時の既定値は null。 */
  providerRef?: string | null
  /** 未指定 = 既存値を維持。新規作成時の既定値は null。 */
  productId?: string | null
  /** 未指定 = 既存値を維持。新規作成時の既定値は false。 */
  cancelAtPeriodEnd?: boolean
  /** 未指定 = 既存値を維持。null を明示すれば期限をクリアする。新規作成時の既定値は null。 */
  expiresAt?: Date | null
  /**
   * provider 側でイベントが発生した時刻（Stripe: `event.created`、RevenueCat: `event_timestamp_ms`）。
   * out-of-order 到着したイベントを無視するための基準値。取得できない場合は null を渡す
   * （その場合は順序判定をスキップし常に適用する＝取得不可を理由に権利更新を止めない）。
   */
  eventAt: Date | null
  eventId?: string | null
}

export interface EntitlementRecord {
  id: string
  userId: string
  provider: EntitlementProvider
  providerRef: string | null
  productId: string | null
  status: EntitlementStatus
  cancelAtPeriodEnd: boolean
  expiresAt: Date | null
  providerEventAt: Date | null
  lastEventId: string | null
}

export interface ApplyEntitlementEventResult {
  /** out-of-order と判定され無視された場合は false */
  applied: boolean
  entitlement: EntitlementRecord
}

export interface AggregateResult {
  isPremium: boolean
  premiumExpiresAt: Date | null
  wasPremiumBefore: boolean
}

/** 個々の entitlement が「現在有効（premium 権利を与えている）」かどうかを判定する。 */
function isEntitlementActive(
  entitlement: { status: EntitlementStatus; expiresAt: Date | null },
  now: Date,
): boolean {
  if (entitlement.status !== 'active') return false
  return entitlement.expiresAt === null || entitlement.expiresAt.getTime() > now.getTime()
}

/**
 * Provider entitlement イベントを 1 行へ適用する（upsert）。
 *
 * out-of-order 防御: 直近適用済みイベントの発生時刻より古いイベントは無視する
 * （例: 古い expiration が新しい renewal の後に届いても、有効な状態を巻き戻さない）。
 * `eventAt` が null（取得不可）の場合は比較せず常に適用する。
 */
export async function applyEntitlementEvent(
  db: Db,
  input: EntitlementEventInput,
): Promise<ApplyEntitlementEventResult> {
  const { userId, provider, eventAt, eventId } = input

  const existing = await db.premiumEntitlement.findUnique({
    where: { userId_provider: { userId, provider } },
  })

  if (existing?.providerEventAt && eventAt && eventAt.getTime() < existing.providerEventAt.getTime()) {
    logger.info('PremiumEntitlement: stale event ignored (out-of-order)', {
      userId,
      provider,
      eventId,
      eventAt,
      lastAppliedEventAt: existing.providerEventAt,
    })
    return { applied: false, entitlement: existing }
  }

  // eventAt が取得できないイベントで上書きすると、以後の比較基準を失ってしまうため、
  // 既知の providerEventAt を保持する（次回以降の out-of-order 判定を維持するため）。
  const nextProviderEventAt = eventAt ?? existing?.providerEventAt ?? null

  const updateData: Prisma.PremiumEntitlementUpdateInput = {
    ...(input.providerRef !== undefined && { providerRef: input.providerRef }),
    ...(input.productId !== undefined && { productId: input.productId }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: input.cancelAtPeriodEnd }),
    ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
    providerEventAt: nextProviderEventAt,
    lastEventId: eventId ?? null,
  }

  const createData: Prisma.PremiumEntitlementCreateInput = {
    user: { connect: { id: userId } },
    provider,
    status: input.status ?? 'active',
    providerRef: input.providerRef ?? null,
    productId: input.productId ?? null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    expiresAt: input.expiresAt ?? null,
    providerEventAt: nextProviderEventAt,
    lastEventId: eventId ?? null,
  }

  const entitlement = await db.premiumEntitlement.upsert({
    where: { userId_provider: { userId, provider } },
    create: createData,
    update: updateData,
  })

  return { applied: true, entitlement }
}

/**
 * ユーザーの全 PremiumEntitlement から isPremium / premiumExpiresAt を再計算し、User へ反映する。
 *
 * `premiumExpiresAt` の null semantics:
 * - 有効な entitlement が 1 件も無い → null（非プレミアム）
 * - 有効な entitlement は存在するが、その中に expiresAt が不明（null）なものが含まれる → null
 *   （「期限不明」を意味する。無期限を意味するわけではない。UI は premiumExpiresAt が null の場合、
 *   期限表示を省略する想定。既存の Stripe フロー（checkout 時に必ずフォールバック期限を設定）では
 *   実質発生しないが、将来 provider 側が期限情報を返さないケースに備えて明文化する）
 * - 有効な entitlement が全て expiresAt を持つ → その最大値
 */
export async function recomputeUserPremiumAggregate(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<AggregateResult> {
  const [user, entitlements] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { isPremium: true } }),
    db.premiumEntitlement.findMany({
      where: { userId },
      select: { status: true, expiresAt: true },
    }),
  ])

  if (!user) {
    logger.error('recomputeUserPremiumAggregate: user not found, skipping aggregate update', {
      userId,
    })
    return { isPremium: false, premiumExpiresAt: null, wasPremiumBefore: false }
  }

  const wasPremiumBefore = user.isPremium
  const activeEntitlements = entitlements.filter((e) => isEntitlementActive(e, now))
  const isPremium = activeEntitlements.length > 0

  let premiumExpiresAt: Date | null = null
  if (isPremium) {
    const hasUnknownExpiry = activeEntitlements.some((e) => e.expiresAt === null)
    if (!hasUnknownExpiry) {
      premiumExpiresAt = activeEntitlements.reduce<Date | null>((max, e) => {
        if (!e.expiresAt) return max
        return !max || e.expiresAt.getTime() > max.getTime() ? e.expiresAt : max
      }, null)
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { isPremium, premiumExpiresAt },
  })

  return { isPremium, premiumExpiresAt, wasPremiumBefore }
}

export interface ApplyAndRecomputeResult {
  applied: boolean
  wasPremiumBefore: boolean
  isPremiumAfter: boolean
  premiumExpiresAt: Date | null
}

/**
 * Entitlement イベントの適用と User aggregate の再計算を単一トランザクションで atomic に行う。
 *
 * Webhook route handler から呼ぶ想定（cron の期限切れスイープは
 * `expireOverdueEntitlementsForUser` を使う）。
 */
export async function applyEntitlementEventAndRecompute(
  input: EntitlementEventInput,
  now: Date = new Date(),
): Promise<ApplyAndRecomputeResult> {
  return prisma.$transaction(async (tx) => {
    const { applied } = await applyEntitlementEvent(tx, input)
    const { isPremium, premiumExpiresAt, wasPremiumBefore } = await recomputeUserPremiumAggregate(
      tx,
      input.userId,
      now,
    )
    return { applied, wasPremiumBefore, isPremiumAfter: isPremium, premiumExpiresAt }
  })
}

/**
 * 期限（expiresAt）を過ぎた active entitlement を 'expired' へ確定させる。
 * cron の期限切れスイープ専用（webhook 経由の即時失効は applyEntitlementEvent 側で status を渡す）。
 */
export async function expireOverdueEntitlements(
  db: Db,
  userId: string,
  now: Date,
): Promise<number> {
  const result = await db.premiumEntitlement.updateMany({
    where: { userId, status: 'active', expiresAt: { not: null, lt: now } },
    data: { status: 'expired' },
  })
  return result.count
}

export interface ExpireUserResult {
  wasPremiumBefore: boolean
  isPremiumAfter: boolean
  premiumExpiresAt: Date | null
  expiredCount: number
}

/**
 * 1 ユーザー分の「期限切れ entitlement の確定 → aggregate 再計算」を単一トランザクションで行う。
 *
 * 呼び出し元（cron）は `wasPremiumBefore && !isPremiumAfter` の場合のみ、失効メール・
 * システム通知・予約投稿キャンセルなどの副作用を実行する（true→false の transition が
 * 実際に起きた場合だけ 1 回）。同じ entitlement 行は本関数の呼び出しで 'expired' に
 * 確定するため、次回以降の cron 実行では条件（status='active'）に再び一致せず、
 * 副作用が重複実行されることはない。
 */
export async function expireOverdueEntitlementsForUser(
  userId: string,
  now: Date = new Date(),
): Promise<ExpireUserResult> {
  return prisma.$transaction(async (tx) => {
    const expiredCount = await expireOverdueEntitlements(tx, userId, now)
    const { isPremium, premiumExpiresAt, wasPremiumBefore } = await recomputeUserPremiumAggregate(
      tx,
      userId,
      now,
    )
    return { wasPremiumBefore, isPremiumAfter: isPremium, premiumExpiresAt, expiredCount }
  })
}

/** 期限切れ entitlement を持つユーザー ID 一覧（重複なし）を取得する。cron のスイープ対象抽出用。 */
export async function findUsersWithOverdueEntitlements(now: Date = new Date()): Promise<string[]> {
  const rows = await prisma.premiumEntitlement.findMany({
    where: { status: 'active', expiresAt: { not: null, lt: now } },
    select: { userId: true },
    distinct: ['userId'],
  })
  return rows.map((r) => r.userId)
}
