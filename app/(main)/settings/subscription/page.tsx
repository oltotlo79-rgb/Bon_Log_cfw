/**
 * @fileoverview プラン管理（サブスクリプション）ページ
 *
 * このファイルはログインユーザーのプレミアム会員プランを管理するためのページコンポーネントです。
 * Stripeと連携した決済機能を提供し、月額/年額プランの選択と支払い履歴の確認ができます。
 *
 * 主な機能:
 * - 現在のサブスクリプション状態の表示
 * - プレミアムプランへの登録（月額350円/年額3,500円）
 * - 支払い成功/キャンセル時のフィードバック表示
 * - 支払い履歴の一覧表示
 * - プランの解約（サブスクリプションキャンセル）
 * - 認証チェックによるアクセス制御
 *
 * プレミアム会員の特典:
 * - 投稿の予約投稿機能
 * - 下書き保存数の上限解放
 * - 広告非表示
 * - 詳細なアナリティクス機能
 *
 * @requires 認証必須 - 未ログインユーザーはログインページへリダイレクト
 */

// Next.jsのナビゲーションユーティリティ（リダイレクト用）
import { redirect } from 'next/navigation'

// NextAuth.jsの認証ヘルパー（現在のセッション取得用）
import { auth } from '@/lib/auth'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// ゲスト判定
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { SettingsGuestRestriction } from '@/components/settings/SettingsGuestRestriction'

// Prismaデータベースクライアント（支払い履歴取得用）
import { prisma } from '@/lib/db'

// サブスクリプション状態取得用のServer Action
import { getSubscriptionStatus } from '@/lib/actions/subscription'

// Stripe価格ID（環境変数アクセスは lib/stripe.ts に集約）
import { STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_YEARLY } from '@/lib/stripe'

// サブスクリプション状態表示コンポーネント（現在のプランと有効期限）
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus'

// 料金プラン選択カードコンポーネント（月額/年額プラン）
import { PricingCard } from '@/components/subscription/PricingCard'

// 支払い履歴一覧コンポーネント
import { PaymentHistory } from '@/components/subscription/PaymentHistory'

// shadcn/uiのアラートコンポーネント（成功/キャンセルメッセージ用）
import { Alert, AlertDescription } from '@/components/ui/alert'

// Lucideアイコン（チェック、×、王冠アイコン）
import { CheckCircle, XCircle, Crown } from 'lucide-react'
import Image from 'next/image'
// 制限値定数
import { PAYMENT_HISTORY_LIMIT, PREMIUM_PRICE_MONTHLY_JPY, PREMIUM_PRICE_YEARLY_JPY } from '@/lib/constants/limits'

/**
 * ページタイトルの設定
 */
export const metadata = {
  title: 'プラン管理 | BON-LOG',
  // 認証必須のユーザー個別データのため検索エンジンには公開しない
  robots: { index: false, follow: false },
}

/**
 * ユーザーの支払い履歴を取得するヘルパー関数
 *
 * Stripeからの支払い記録をデータベースから取得します。
 * 最新10件を新しい順で返します。
 *
 * @param {string} userId - 対象ユーザーのID
 * @returns {Promise<Payment[]>} 支払い履歴の配列
 */
async function getPaymentHistory(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: PAYMENT_HISTORY_LIMIT,  // 最新10件のみ取得
  })
}

/**
 * プラン管理ページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. セッションの認証チェック
 * 2. URLパラメータから決済結果を確認（success/canceled）
 * 3. サブスクリプション状態と支払い履歴を並列で取得
 * 4. プレミアム会員でない場合は料金プランを表示
 * 5. プレミアム会員の場合は現在のプラン情報を表示
 *
 * @param {Object} props - コンポーネントのプロパティ
 * @param {Promise<{ success?: string; canceled?: string }>} props.searchParams - URLクエリパラメータ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>
}) {
  // URLパラメータを非同期で取得（Next.js 15の新仕様）
  const params = await searchParams

  // 現在のセッションを取得（認証状態の確認）
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }
  const email = session.user.email
  if (email === GUEST_EMAIL) {
    return <SettingsGuestRestriction title="プラン管理" />
  }

  // サブスクリプション状態と支払い履歴を並列で取得（パフォーマンス最適化）
  const [statusResult, payments] = await Promise.all([
    getSubscriptionStatus(),                    // 現在のプラン状態
    getPaymentHistory(session.user.id),        // 支払い履歴
  ])

  // サブスクリプション状態のデータを整形（エラーハンドリング含む）
  const isPremium = 'error' in statusResult ? false : statusResult.isPremium
  const premiumExpiresAt = 'error' in statusResult ? null : statusResult.premiumExpiresAt
  const subscription = 'error' in statusResult ? null : statusResult.subscription

  // Stripe価格ID（lib/stripe.ts 経由で参照、未設定時は空文字へフォールバック）
  const monthlyPriceId = STRIPE_PRICE_ID_MONTHLY ?? ''
  const yearlyPriceId = STRIPE_PRICE_ID_YEARLY ?? ''

  // プラン管理ページのUIをレンダリング
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
              <li>・ 投稿文字数 2000 文字まで</li>
              <li>・ 画像添付 6 枚・動画添付 3 本まで</li>
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
              popular  // おすすめバッジ表示
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

      {/* 注意事項（利用規約関連の説明） */}
      <div className="mt-8 text-xs text-muted-foreground space-y-1">
        <p>・ お支払いはクレジットカードで承ります</p>
        <p>・ サブスクリプションはいつでもキャンセルできます</p>
        <p>・ キャンセル後も期間終了まで機能をご利用いただけます</p>
        <p>・ 料金は税込表示です</p>
      </div>
    </div>
  )
}
