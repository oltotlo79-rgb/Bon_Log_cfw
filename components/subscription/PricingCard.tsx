/**
 * @file PricingCard.tsx
 * @description プレミアムプランの料金カードコンポーネント
 *
 * このコンポーネントは、プレミアム会員プランの料金情報を表示し、
 * Stripeチェックアウトへの導線を提供します。月額・年額プランに対応しています。
 *
 * @features
 * - プラン情報（名前、価格、期間）の表示
 * - プレミアム機能リストの表示
 * - Stripeチェックアウトへの遷移
 * - 「おすすめ」ラベルの表示オプション
 * - 既存プレミアム会員向けの「利用中」表示
 * - ローディング状態とエラーハンドリング
 *
 * @usage
 * ```tsx
 * // 月額プラン
 * <PricingCard
 *   isPremium={false}
 *   priceId="price_monthly_123"
 *   priceType="monthly"
 *   planName="月額プラン"
 *   price={500}
 *   period="月"
 * />
 *
 * // 年額プラン（おすすめ表示付き）
 * <PricingCard
 *   isPremium={false}
 *   priceId="price_yearly_456"
 *   priceType="yearly"
 *   planName="年額プラン"
 *   price={5000}
 *   period="年"
 *   description="2ヶ月分お得"
 *   popular={true}
 * />
 * ```
 */

'use client'

// Reactの状態管理フック
import { useState } from 'react'

// shadcn/uiのUIコンポーネント
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// サブスクリプション管理用Server Action
// Stripeチェックアウトセッションを作成する
import { createCheckoutSession } from '@/lib/actions/subscription'

// lucide-reactのアイコン
// Check: チェックマークアイコン（機能リストの項目に使用）
// Crown: 王冠アイコン（プレミアム会員を象徴）
// Loader2: ローディングスピナー
import { Check, Crown, Loader2 } from 'lucide-react'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * PricingCardコンポーネントのプロパティ型定義
 */
type PricingCardProps = {
  /** ユーザーが既にプレミアム会員かどうか */
  isPremium: boolean
  /** StripeのPrice ID */
  priceId: string
  /** プランの種類（月額 or 年額） */
  priceType: 'monthly' | 'yearly'
  /** プラン名（例: '月額プラン', '年額プラン'） */
  planName: string
  /** 価格（円） */
  price: number
  /** 請求期間（例: '月', '年'） */
  period: string
  /** プランの説明文（任意） */
  description?: string
  /** 「おすすめ」ラベルを表示するかどうか */
  popular?: boolean
}

/**
 * プレミアム会員の特典リスト
 * 無料会員との差別化ポイントを明確に示す
 */
const features = [
  '投稿文字数 2000文字',    // 無料会員は500文字まで
  '画像添付 6枚まで',        // 無料会員は4枚まで
  '動画添付 3本まで',        // 無料会員は1本まで
  '予約投稿機能',            // 無料会員は利用不可
  '投稿分析ダッシュボード',  // 無料会員は利用不可
  '広告非表示',              // サイト全体の広告が非表示
]

/**
 * 料金カードコンポーネント
 *
 * プレミアム会員プランの料金情報を表示し、Stripeチェックアウトへの
 * 導線を提供するカードコンポーネント。月額・年額プランに対応。
 *
 * @param props - コンポーネントのプロパティ
 * @returns 料金カードのJSX要素
 */
export function PricingCard({
  isPremium,
  priceType,
  planName,
  price,
  period,
  description,
  popular = false,
}: PricingCardProps) {
  /**
   * ローディング状態を管理するstate
   * Stripeチェックアウトへの遷移処理中にtrueになる
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラーメッセージを管理するstate
   * チェックアウトセッション作成に失敗した場合にエラーメッセージを保持
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * 登録ボタンのクリックハンドラ
   *
   * Stripeチェックアウトセッションを作成し、
   * ユーザーをStripeの決済ページにリダイレクトする
   */
  async function handleSubscribe() {
    // ローディング状態を開始し、以前のエラーをクリア
    setLoading(true)
    setError(null)

    // Server Actionを呼び出してチェックアウトセッションを作成
    // priceTypeに応じて月額または年額のセッションを作成
    const result = await createCheckoutSession(priceType)

    if ('error' in result) {
      // エラーが発生した場合はエラーメッセージを表示
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else if (result.url) {
      // 成功した場合はStripeチェックアウトページにリダイレクト
      window.location.href = result.url
    }
  }

  return (
    // カードコンテナ: popularがtrueの場合は強調スタイルを適用
    <Card className={`relative overflow-visible ${popular ? 'border-primary shadow-lg' : ''}`}>
      {/* 「おすすめ」ラベル: popularがtrueの場合のみ表示 */}
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
            おすすめ
          </span>
        </div>
      )}

      {/* カードヘッダー: プラン情報と価格 */}
      <CardHeader className="text-center pb-2">
        {/* 王冠アイコンを円形背景で囲む */}
        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
          <Crown className="w-6 h-6 text-primary" />
        </div>
        {/* プラン名 */}
        <CardTitle className="text-lg">{planName}</CardTitle>
        {/* プラン説明（任意） */}
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
        {/* 価格表示 */}
        <div className="mt-4">
          <span className="text-4xl font-bold">¥{price.toLocaleString()}</span>
          <span className="text-muted-foreground">/{period}</span>
        </div>
      </CardHeader>

      {/* カードコンテンツ: 機能リストとCTAボタン */}
      <CardContent>
        {/* プレミアム機能リスト */}
        <ul className="space-y-3 mb-6">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              {/* チェックマークアイコン: 利用可能な機能を示す */}
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* エラーメッセージ表示 */}
        {error && (
          <p className="text-sm text-destructive mb-4 text-center">{error}</p>
        )}

        {/* CTAボタン: プレミアム会員かどうかで表示を切り替え */}
        {isPremium ? (
          // 既にプレミアム会員の場合: 無効化されたボタンを表示
          <Button className="w-full" disabled variant="secondary">
            現在ご利用中
          </Button>
        ) : (
          // 非プレミアム会員の場合: 登録ボタンを表示
          <Button
            variant="bonsai"
            className="w-full"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              // ローディング中の表示
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                処理中...
              </>
            ) : (
              // 通常時の表示
              'プレミアムに登録'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
