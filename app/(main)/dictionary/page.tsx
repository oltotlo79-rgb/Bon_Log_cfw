import { Metadata } from 'next'
import Image from 'next/image'
import { Suspense } from 'react'
import {
  isDictionaryCategory,
  isKanaRowLabel,
} from '@/lib/constants/dictionary'
import { DictionarySearch } from '@/components/dictionary/DictionarySearch'
import { PostDetailAdUnit } from '@/components/ads'
import { ROUTE_DICTIONARY } from '@/lib/constants/routes'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'
import { TermList } from './TermList'

export const metadata: Metadata = {
  title: pageTitle('盆栽用語辞典'),
  description: '盆栽の樹形・技術・管理・道具・用土など、盆栽に関する用語をまとめた辞典です。',
  alternates: { canonical: pageCanonical(ROUTE_DICTIONARY) },
}

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = {
  searchParams: Promise<{
    search?: string
    category?: string
    row?: string
  }>
}

export default async function DictionaryPage({ searchParams }: Props) {
  const params = await searchParams
  const search = params.search?.trim()
  const category = isDictionaryCategory(params.category) ? params.category : undefined
  const row = isKanaRowLabel(params.row) ? params.row : undefined

  return (
    <div className="space-y-6">
      <div className="relative w-full h-24 md:h-32 rounded-lg overflow-hidden mb-4">
        <Image src="/images/generated/ui/dictionary-header-mobile.webp" alt="" fill className="object-cover opacity-80 md:hidden dark:hidden" />
        <Image src="/images/generated/ui/dictionary-header.webp" alt="" fill className="object-cover opacity-80 hidden md:block dark:hidden" />
        <Image src="/images/generated/ui/dictionary-header-dark.webp" alt="" fill className="object-cover opacity-80 hidden dark:block" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">盆栽用語辞典</h1>
        <p className="text-sm text-muted-foreground mt-1">
          樹形・技術・管理・道具・用土など盆栽に関する用語を収録しています
        </p>
      </div>

      <DictionarySearch defaultSearch={search} defaultCategory={category} defaultRow={row} />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        }
      >
        <TermList search={search} category={category} row={row} />
      </Suspense>

      <aside aria-label="広告">
        <PostDetailAdUnit />
      </aside>
    </div>
  )
}
