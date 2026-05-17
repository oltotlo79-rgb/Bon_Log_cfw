/**
 * @file PaymentHistory.tsx
 * @description 支払い履歴を表示するコンポーネント
 *
 * このコンポーネントは、ユーザーの過去の支払い履歴を一覧表示します。
 * 各支払いについて、金額、日付、ステータスを表示します。
 *
 * @features
 * - 支払い履歴の一覧表示
 * - 金額の通貨形式フォーマット（日本円対応）
 * - 支払いステータスの視覚的表示（完了/処理中/失敗）
 * - 日本語形式の日付表示
 *
 * @usage
 * ```tsx
 * const payments = [
 *   {
 *     id: 'pay_123',
 *     amount: 500,
 *     currency: 'jpy',
 *     status: 'succeeded',
 *     description: 'プレミアム会員（月額）',
 *     createdAt: new Date('2024-01-15')
 *   }
 * ]
 *
 * <PaymentHistory payments={payments} />
 * ```
 */

'use client'

// shadcn/uiのCardコンポーネント群: カードレイアウト用
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// lucide-reactのアイコン
// Receipt: 領収書アイコン（支払い履歴を象徴）
import { Receipt } from 'lucide-react'

/**
 * 支払い情報の型定義
 */
type Payment = {
  /** 支払いの一意識別子（Stripe Payment ID） */
  id: string
  /** 支払い金額（最小通貨単位、JPYの場合は円） */
  amount: number
  /** 通貨コード（例: 'jpy', 'usd'） */
  currency: string
  /** 支払いステータス（'succeeded', 'pending', 'failed'など） */
  status: string
  /** 支払いの説明（プラン名など） */
  description: string | null
  /** 支払い作成日時 */
  createdAt: Date
}

/**
 * PaymentHistoryコンポーネントのプロパティ型定義
 */
type PaymentHistoryProps = {
  /** 表示する支払い履歴の配列 */
  payments: Payment[]
}

/**
 * 日付を日本語短縮形式でフォーマットする関数
 *
 * @param date - フォーマット対象の日付
 * @returns 日本語形式の日付文字列（例: 2024年1月15日）
 */
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',  // 年を数値で表示
    month: 'short',   // 月を「1月」形式で表示（shortは略称）
    day: 'numeric',   // 日を数値で表示
  })
}

/**
 * 金額を通貨形式でフォーマットする関数
 *
 * 日本円（JPY）の場合は円マーク付きで表示、
 * その他の通貨は金額と通貨コードを表示
 *
 * @param amount - 金額
 * @param currency - 通貨コード
 * @returns フォーマット済みの金額文字列
 */
function formatAmount(amount: number, currency: string) {
  if (currency.toLowerCase() === 'jpy') {
    // 日本円の場合: ¥500 形式
    return `¥${amount.toLocaleString()}`
  }
  // その他の通貨: 500 USD 形式
  return `${amount.toLocaleString()} ${currency.toUpperCase()}`
}

/**
 * 支払いステータスに対応するラベルとスタイルを取得する関数
 *
 * @param status - 支払いステータス
 * @returns ラベル文字列とCSSクラス名のオブジェクト
 */
function getStatusLabel(status: string) {
  switch (status) {
    case 'succeeded':
      // 支払い完了: 通常色で表示
      return { label: '完了', className: 'text-foreground' }
    case 'pending':
      // 処理中: ミュート色で表示
      return { label: '処理中', className: 'text-muted-foreground' }
    case 'failed':
      // 支払い失敗: destructive色で表示
      return { label: '失敗', className: 'text-destructive' }
    default:
      // 未知のステータス: グレーでそのまま表示
      return { label: status, className: 'text-muted-foreground' }
  }
}

/**
 * 支払い履歴コンポーネント
 *
 * ユーザーの過去の支払い履歴を一覧表示するカードコンポーネント。
 * 各支払いの金額、日付、ステータスを視覚的に分かりやすく表示する。
 *
 * @param props - コンポーネントのプロパティ
 * @returns 支払い履歴カードのJSX要素、履歴がない場合はnull
 */
export function PaymentHistory({ payments }: PaymentHistoryProps) {
  // 支払い履歴がない場合は何も表示しない
  if (payments.length === 0) {
    return null
  }

  return (
    <Card>
      {/* カードヘッダー: 領収書アイコンとタイトル */}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">支払い履歴</CardTitle>
        </div>
      </CardHeader>

      {/* カードコンテンツ: 支払い履歴リスト */}
      <CardContent>
        <div className="space-y-3">
          {/* 各支払い項目をマップして表示 */}
          {payments.map((payment) => {
            // ステータスのラベルとスタイルを取得
            const status = getStatusLabel(payment.status)
            return (
              <div
                key={payment.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                {/* 左側: 支払い説明と日付 */}
                <div>
                  {/* 支払い説明: 説明がない場合は'プレミアム会員'と表示 */}
                  <p className="text-sm font-medium">
                    {payment.description || 'プレミアム会員'}
                  </p>
                  {/* 支払い日 */}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>

                {/* 右側: 金額とステータス */}
                <div className="text-right">
                  {/* 支払い金額 */}
                  <p className="text-sm font-medium">
                    {formatAmount(payment.amount, payment.currency)}
                  </p>
                  {/* 支払いステータス: ステータスに応じた色で表示 */}
                  <p className={`text-xs ${status.className}`}>
                    {status.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
