/**
 * @module components/subscription/PaymentHistory
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'

type Payment = {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  createdAt: Date
}

type PaymentHistoryProps = {
  payments: Payment[]
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatAmount(amount: number, currency: string) {
  if (currency.toLowerCase() === 'jpy') {
    return `¥${amount.toLocaleString()}`
  }
  return `${amount.toLocaleString()} ${currency.toUpperCase()}`
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'succeeded':
      return { label: '完了', className: 'text-foreground' }
    case 'pending':
      return { label: '処理中', className: 'text-muted-foreground' }
    case 'failed':
      return { label: '失敗', className: 'text-destructive' }
    default:
      return { label: status, className: 'text-muted-foreground' }
  }
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">支払い履歴</CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {payments.map((payment) => {
            const status = getStatusLabel(payment.status)
            return (
              <div
                key={payment.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {payment.description || 'プレミアム会員'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium">
                    {formatAmount(payment.amount, payment.currency)}
                  </p>
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
