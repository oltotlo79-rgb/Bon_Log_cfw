import { notFound, redirect } from 'next/navigation'

import { auth } from '@/lib/auth'

import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { buildBonsaiPath } from '@/lib/constants/path-builders'

import { getBonsai } from '@/lib/actions/bonsai'

import Link from 'next/link'

import { BonsaiForm } from '@/components/bonsai/BonsaiForm'

import type { Metadata } from 'next'

// オーナー専用の認証必須画面のため index させない。動的タイトルは過剰なので static
export const metadata: Metadata = {
  title: '盆栽を編集',
  description: '登録済みの盆栽情報を編集します。',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ id: string }>
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

export default async function EditBonsaiPage({ params }: Props) {
  const { id } = await params

  const session = await auth()

  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const result = await getBonsai(id)

  if (!result.success || !result.data?.bonsai) {
    notFound()
  }

  const bonsai = result.data.bonsai

  if (bonsai.userId !== session.user.id) {
    redirect(buildBonsaiPath(id))
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={buildBonsaiPath(id)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            盆栽詳細に戻る
          </Link>
        </div>

        <div className="p-4">
          <h1 className="text-xl font-bold mb-6">盆栽を編集</h1>

          <BonsaiForm bonsai={bonsai} />
        </div>
      </div>
    </div>
  )
}
