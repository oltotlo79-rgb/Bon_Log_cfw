import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getContactInquiry } from '@/lib/actions/contact'
import { ContactDetailActions } from './ContactDetailActions'
import { ROUTE_ADMIN_CONTACT } from '@/lib/constants/routes'

const STATUS_LABELS: Record<string, string> = {
  pending: '未対応',
  in_progress: '対応中',
  resolved: '解決済',
  closed: 'クローズ', // 対応完了、追加対応不要
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  in_progress: 'bg-blue-500/10 text-blue-600',
  resolved: 'bg-green-500/10 text-green-600',
  closed: 'bg-gray-500/10 text-gray-600', // クローズ済み（グレー）
}

const CATEGORY_LABELS: Record<string, string> = {
  general: '一般的なお問い合わせ',
  account: 'アカウントについて',
  bug: '不具合の報告',
  feature: '機能のリクエスト',
  premium: 'プレミアム会員について',
  other: 'その他', // 上記に当てはまらないカテゴリー
}

export const metadata = {
  title: 'お問い合わせ詳細 - BON-LOG 管理',
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getContactInquiry(id)

  if (!result.success || !result.data?.inquiry) {
    notFound()
  }

  const inquiry = result.data.inquiry

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">お問い合わせ詳細</h1>
        <Link href={ROUTE_ADMIN_CONTACT} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 一覧に戻る
        </Link>
      </div>

      <div className="bg-card rounded-lg border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm ${STATUS_COLORS[inquiry.status] || ''}`}>
            {STATUS_LABELS[inquiry.status] || inquiry.status}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">
            {CATEGORY_LABELS[inquiry.category] || inquiry.category}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">名前</p>
            <p className="font-medium">{inquiry.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">メールアドレス</p>
            <p className="font-medium">
              <a href={`mailto:${inquiry.email}`} className="text-blue-600 hover:underline">
                {inquiry.email}
              </a>
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">受信日時</p>
            <p className="font-medium">{new Date(inquiry.createdAt).toLocaleString('ja-JP')}</p>
          </div>
          {inquiry.respondedAt && (
            <div>
              <p className="text-sm text-muted-foreground">対応日時</p>
              <p className="font-medium">{new Date(inquiry.respondedAt).toLocaleString('ja-JP')}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">件名</p>
          <p className="font-medium text-lg">{inquiry.subject}</p>
        </div>

        {/* お問い合わせ本文（改行を保持するためwhitespace-pre-wrap） */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">お問い合わせ内容</p>
          <div className="bg-muted/50 rounded-md p-4 whitespace-pre-wrap text-sm">
            {inquiry.message}
          </div>
        </div>

        {inquiry.adminNote && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">管理者メモ</p>
            <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-4 whitespace-pre-wrap text-sm">
              {inquiry.adminNote}
            </div>
          </div>
        )}
      </div>

      <ContactDetailActions
        inquiryId={inquiry.id}
        currentStatus={inquiry.status}
        currentNote={inquiry.adminNote || ''}
      />
    </div>
  )
}
