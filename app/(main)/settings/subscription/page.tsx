/**
 * @module app/(main)/settings/subscription/page
 * プレミアム会員のプラン管理ページ（Stripe 決済・支払い履歴）。
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'
import { prisma } from '@/lib/db'
import { getSubscriptionStatus } from '@/lib/actions/subscription'
import { STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_YEARLY } from '@/lib/stripe'
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus'
import { PricingCard } from '@/components/subscription/PricingCard'
import { PaymentHistory } from '@/components/subscription/PaymentHistory'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Crown } from 'lucide-react'
import Image from 'next/image'
import {
  PAYMENT_HISTORY_LIMIT,
  PREMIUM_PRICE_MONTHLY_JPY,
  PREMIUM_PRICE_YEARLY_JPY,
  MAX_POST_CONTENT_PREMIUM,
  MAX_POST_IMAGES_PREMIUM,
  MAX_POST_VIDEOS_PREMIUM,
} from '@/lib/constants/limits'

export const metadata = {
  title: 'プラン管理 | BON-LOG',
  // 認証必須のユーザー個別データのため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

async function getPaymentHistory(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: PAYMENT_HISTORY_LIMIT,
  })
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>
}) {
  const params = await searchParams

  const session = await auth()

  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="プラン管理" />
  }

  const [statusResult, payments] = await Promise.all([
    getSubscriptionStatus(),
    getPaymentHistory(session.user.id),
  ])

  const isPremium = 'error' in statusResult ? false : statusResult.isPremium
  const premiumExpiresAt = 'error' in statusResult ? null : statusResult.premiumExpiresAt
  const subscription = 'error' in statusResult ? null : statusResult.subscription

  const monthlyPriceId = STRIPE_PRICE_ID_MONTHLY ?? ''
  const yearlyPriceId = STRIPE_PRICE_ID_YEARLY ?? ''

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <div className="relative h-24 rounded-lg overflow-hidden mb-6">
        <Image
          src="/images/generated/premium/premium-bg-pattern.webp"
          alt=""
          fill
          className="object-cover opacity-30 dark:hidden"
        />
        <Image
          src="/images/generated/premium/premium-bg-pattern-dark.webp"
          alt=""
          fill
          className="object-cover opacity-30 hidden dark:block"
        />
        <div className="absolute inset-0 flex items-center gap-3 px-6">
          <Crown className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">プラン管理</h1>
        </div>
      </div>

      {params.success === 'true' && (
        <Alert className="mb-6 border-border bg-muted/50">
          <CheckCircle className="w-4 h-4 text-foreground" />
          <AlertDescription className="text-foreground">
            プレミアム会員への登録が完了しました。すべての機能をご利用いただけます。
          </AlertDescription>
        </Alert>
      )}

      {params.canceled === 'true' && (
        <Alert className="mb-6 border-border bg-muted/50">
          <XCircle className="w-4 h-4 text-muted-foreground" />
          <AlertDescription className="text-muted-foreground">
            登録がキャンセルされました。いつでも再度お申し込みいただけます。
          </AlertDescription>
        </Alert>
      )}

      {isPremium && (
        <div className="mb-6 space-y-4">
          <SubscriptionStatus
            isPremium={isPremium}
            premiumExpiresAt={premiumExpiresAt}
            subscription={subscription}
          />
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              ご利用中の特典
            </h2>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>・ 投稿文字数 {MAX_POST_CONTENT_PREMIUM} 文字まで</li>
              <li>・ 画像添付 {MAX_POST_IMAGES_PREMIUM} 枚・動画添付 {MAX_POST_VIDEOS_PREMIUM} 本まで</li>
              <li>・ 予約投稿機能</li>
              <li>・ 投稿分析ダッシュボード</li>
              <li>・ 広告非表示（サイト全体）</li>
            </ul>
          </div>
        </div>
      )}

      {!isPremium && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">料金プラン</h2>
          <div className="grid gap-4 md:grid-cols-2 pt-4">
            <PricingCard
              isPremium={isPremium}
              priceId={monthlyPriceId}
              priceType="monthly"
              planName="月額プラン"
              price={PREMIUM_PRICE_MONTHLY_JPY}
              period="月"
              popular
            />
            <PricingCard
              isPremium={isPremium}
              priceId={yearlyPriceId}
              priceType="yearly"
              planName="年額プラン"
              price={PREMIUM_PRICE_YEARLY_JPY}
              period="年"
              description="2ヶ月分お得"
            />
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <PaymentHistory payments={payments} />
      )}

      <div className="mt-8 text-xs text-muted-foreground space-y-1">
        <p>・ お支払いはクレジットカードで承ります</p>
        <p>・ サブスクリプションはいつでもキャンセルできます</p>
        <p>・ キャンセル後も期間終了まで機能をご利用いただけます</p>
        <p>・ 料金は税込表示です</p>
      </div>
    </div>
  )
}
