/**
 * @file SubscriptionStatus.tsx
 * @description サブスクリプション（プレミアム会員）のステータス表示コンポーネント
 *
 * このコンポーネントは、プレミアム会員ユーザーの現在のサブスクリプション状態を
 * 表示し、Stripeカスタマーポータルへのアクセスを提供します。
 *
 * @features
 * - プレミアム会員ステータスの表示
 * - サブスクリプションの有効期限・次回更新日の表示
 * - 解約予定の警告表示
 * - Stripeカスタマーポータルへの遷移ボタン
 * - 管理者付与のプレミアム会員にも対応
 *
 * @usage
 * ```tsx
 * // Stripeサブスクリプションがある場合
 * <SubscriptionStatus
 *   isPremium={true}
 *   premiumExpiresAt={null}
 *   subscription={{
 *     status: 'active',
 *     currentPeriodEnd: new Date('2024-12-31'),
 *     cancelAtPeriodEnd: false
 *   }}
 * />
 *
 * // 管理者付与のプレミアム会員の場合
 * <SubscriptionStatus
 *   isPremium={true}
 *   premiumExpiresAt={new Date('2024-12-31')}
 *   subscription={null}
 * />
 * ```
 */

'use client'

// Reactの状態管理フック
import { useState } from 'react'

// shadcn/uiのUIコンポーネント
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// サブスクリプション管理用Server Action
// Stripeカスタマーポータルセッションを作成する
import { createCustomerPortalSession } from '@/lib/actions/subscription'
import { MIN_VALID_YEAR } from '@/lib/constants/limits'

// lucide-reactのアイコン
// Crown: 王冠アイコン（プレミアム会員を象徴）
// ExternalLink: 外部リンクアイコン（ポータルへの遷移を示す）
// Loader2: ローディングスピナー
// AlertCircle: 警告アイコン（解約予定の警告に使用）
import { Crown, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * SubscriptionStatusコンポーネントのプロパティ型定義
 */
type SubscriptionStatusProps = {
  /** ユーザーがプレミアム会員かどうか */
  isPremium: boolean
  /** プレミアム会員の有効期限（管理者付与の場合に使用） */
  premiumExpiresAt: Date | null
  /** Stripeサブスクリプション情報（Stripe経由の場合に使用） */
  subscription: {
    /** サブスクリプションのステータス（'active', 'canceled'など） */
    status: string
    /** 現在の請求期間の終了日 */
    currentPeriodEnd: Date
    /** 期間終了時に解約するかどうか */
    cancelAtPeriodEnd: boolean
  } | null
}

/**
 * 日付を日本語形式でフォーマットする関数
 *
 * @param date - フォーマット対象の日付
 * @returns 日本語形式の日付文字列（例: 2024年12月31日）
 */
function formatDate(date: Date) {
  const d = new Date(date)
  // 無効な日付やエポック日付（1970年）のガード
  if (isNaN(d.getTime()) || d.getFullYear() < MIN_VALID_YEAR) {
    return '取得中...'
  }
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',  // 年を数値で表示
    month: 'long',    // 月を「1月」「12月」形式で表示
    day: 'numeric',   // 日を数値で表示
  })
}

/**
 * サブスクリプションステータス表示コンポーネント
 *
 * プレミアム会員の現在のサブスクリプション状態を表示し、
 * プラン管理（Stripeカスタマーポータル）へのアクセスを提供する
 *
 * @param props - コンポーネントのプロパティ
 * @returns サブスクリプションステータスカードのJSX要素、非プレミアムの場合はnull
 */
export function SubscriptionStatus({
  isPremium,
  premiumExpiresAt,
  subscription,
}: SubscriptionStatusProps) {
  /**
   * ローディング状態を管理するstate
   * Stripeカスタマーポータルへの遷移処理中にtrueになる
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラーメッセージを管理するstate
   * ポータルセッション作成に失敗した場合にエラーメッセージを保持
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * プラン管理ボタンのクリックハンドラ
   *
   * Stripeカスタマーポータルセッションを作成し、
   * ユーザーをポータルページにリダイレクトする
   */
  async function handleManageSubscription() {
    // ローディング状態を開始し、以前のエラーをクリア
    setLoading(true)
    setError(null)

    // Server Actionを呼び出してカスタマーポータルセッションを作成
    const result = await createCustomerPortalSession()

    if ('error' in result) {
      // エラーが発生した場合はエラーメッセージを表示
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else if (result.url) {
      // 成功した場合はStripeカスタマーポータルにリダイレクト
      window.location.href = result.url
    }
  }

  // プレミアム会員でない場合は何も表示しない
  if (!isPremium) {
    return null
  }

  return (
    // カードコンテナ: プライマリカラーを使用したグラデーション背景
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      {/* カードヘッダー: プランタイトルとプレミアムバッジ */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          {/* 左側: 王冠アイコンとタイトル */}
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">現在のプラン</CardTitle>
          </div>
          {/* 右側: プレミアム会員バッジ */}
          <Badge variant="default" className="bg-bonsai-green">
            プレミアム会員
          </Badge>
        </div>
      </CardHeader>

      {/* カードコンテンツ: ステータス詳細と管理ボタン */}
      <CardContent className="space-y-4">
        {subscription ? (
          // Stripeサブスクリプションがある場合の表示
          <>
            {/* ステータス情報セクション */}
            <div className="space-y-2 text-sm">
              {/* サブスクリプションステータス */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ステータス</span>
                <span className="font-medium">
                  {/* 'active'を日本語の'有効'に変換、その他はそのまま表示 */}
                  {subscription.status === 'active' ? '有効' : subscription.status}
                </span>
              </div>
              {/* 次回更新日 */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">次回更新日</span>
                <span className="font-medium">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
              {/* 解約予定の警告メッセージ */}
              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 border border-border text-muted-foreground rounded-md text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>期間終了時に解約されます</span>
                </div>
              )}
            </div>

            {/* エラーメッセージ表示 */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* プラン管理ボタン: Stripeカスタマーポータルへ遷移 */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageSubscription}
              disabled={loading}
            >
              {loading ? (
                // ローディング中の表示
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  読み込み中...
                </>
              ) : (
                // 通常時の表示
                <>
                  プラン管理
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </>
        ) : (
          // 管理者付与のプレミアム会員の場合の表示
          <div className="space-y-2 text-sm">
            {/* 有効期限 */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">有効期限</span>
              <span className="font-medium">
                {/* 期限がある場合は日付を表示、ない場合は'無期限'と表示 */}
                {premiumExpiresAt ? formatDate(premiumExpiresAt) : '無期限'}
              </span>
            </div>
            {/* 管理者付与の説明文 */}
            <p className="text-xs text-muted-foreground mt-2">
              管理者により付与されたプレミアム会員です
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
