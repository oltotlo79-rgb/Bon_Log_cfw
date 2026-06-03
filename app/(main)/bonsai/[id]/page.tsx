import { notFound } from 'next/navigation'

import { Metadata } from 'next'

import { auth } from '@/lib/auth'

import { getBonsai } from '@/lib/actions/bonsai'

import { getPostsByBonsai } from '@/lib/actions/post'

import Link from 'next/link'

import Image from 'next/image'

import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'

import { BonsaiActions } from '@/components/bonsai/BonsaiActions'

import { BonsaiTimeline } from '@/components/bonsai/BonsaiTimeline'
import { BONSAI_DESCRIPTION_PREVIEW_LENGTH } from '@/lib/constants/limits'
import { ROUTE_BONSAI, ROUTE_HOME } from '@/lib/constants/routes'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'
import { buildBonsaiPath, buildUserPath } from '@/lib/constants/path-builders'
import { ArticleJsonLd } from '@/components/seo/JsonLd'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await getBonsai(id)

  if (!result.success || !result.data?.bonsai) {
    return { title: '盆栽が見つかりません' }
  }

  const bonsai = result.data.bonsai
  const title = `${bonsai.name} - マイ盆栽`
  const description = bonsai.description
    ? `${bonsai.species ? `${bonsai.species}の` : ''}盆栽「${bonsai.name}」${bonsai.description.slice(0, BONSAI_DESCRIPTION_PREVIEW_LENGTH)}${bonsai.description.length > BONSAI_DESCRIPTION_PREVIEW_LENGTH ? '...' : ''}`
    : `${bonsai.species ? `${bonsai.species}の` : ''}盆栽「${bonsai.name}」の成長記録`

  const latestImage = bonsai.records?.[0]?.images?.[0]?.url
  const ogImage = latestImage || '/api/og'

  return {
    title: pageTitle(title),
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      url: pageCanonical(buildBonsaiPath(id)),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: bonsai.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: pageCanonical(buildBonsaiPath(id)),
    },
    // /bonsai/* は認証必須リソース（個人の盆栽記録）。robots.txt と二重防御で noindex を明示。
    robots: { index: false, follow: false },
  }
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

function TreeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18" />
      <path d="M8 7a4 4 0 0 1 8 0c0 2-2 3-4 3S8 9 8 7Z" />
      <path d="M6 12a4 4 0 0 1 12 0c0 2-3 3-6 3s-6-1-6-3Z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

export default async function BonsaiDetailPage({ params }: Props) {
  const { id } = await params

  const session = await auth()

  const [result, postsResult] = await Promise.all([
    getBonsai(id),
    getPostsByBonsai(id),
  ])

  if (!result.success || !result.data?.bonsai) {
    notFound()
  }

  const bonsai = result.data.bonsai
  const relatedPosts = postsResult.success ? (postsResult.data?.posts ?? []) : []

  const isOwner = session?.user?.id === bonsai.userId

  const latestImage = bonsai.records?.[0]?.images?.[0]?.url

  const canonicalUrl = pageCanonical(buildBonsaiPath(id))
  const bonsaiDescription = bonsai.description
    ? bonsai.description.slice(0, BONSAI_DESCRIPTION_PREVIEW_LENGTH)
    : `${bonsai.species ? `${bonsai.species}の` : ''}盆栽「${bonsai.name}」の成長記録`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ArticleJsonLd
        headline={bonsai.name}
        datePublished={new Date(bonsai.createdAt).toISOString()}
        dateModified={new Date(bonsai.updatedAt).toISOString()}
        author={{
          name: bonsai.user.nickname,
          url: pageCanonical(buildUserPath(bonsai.user.id)),
        }}
        url={canonicalUrl}
        image={latestImage}
        description={bonsaiDescription}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'ホーム', url: pageCanonical(ROUTE_HOME) },
          { name: 'マイ盆栽', url: pageCanonical(ROUTE_BONSAI) },
          { name: bonsai.name, url: canonicalUrl },
        ]}
      />
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <Link href={ROUTE_BONSAI} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            マイ盆栽に戻る
          </Link>

          {isOwner && <BonsaiActions bonsaiId={id} bonsaiName={bonsai.name} />}
        </div>

        <div className="aspect-video bg-muted relative">
          {latestImage ? (
            <Image
              src={latestImage}
              alt={bonsai.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <TreeIcon className="w-24 h-24 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{bonsai.name}</h1>

              {bonsai.species && (
                <p className="text-muted-foreground">{bonsai.species}</p>
              )}
            </div>
          </div>

          {bonsai.description && (
            <p className="mt-4 text-muted-foreground">{bonsai.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {bonsai.acquiredAt && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                <span>入手: {new Date(bonsai.acquiredAt).toLocaleDateString('ja-JP')}</span>
              </div>
            )}

            <span>{bonsai._count?.records || 0}件の成長記録 / {relatedPosts.length}件の投稿</span>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="bg-card rounded-lg border">
          <h2 className="px-4 py-3 font-bold border-b">成長記録を追加</h2>
          <div className="p-4">
            <BonsaiRecordForm bonsaiId={id} />
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border">
        <h2 className="px-4 py-3 font-bold border-b">タイムライン</h2>
        <BonsaiTimeline
          records={bonsai.records || []}
          posts={relatedPosts}
          isOwner={isOwner}
          currentUserId={session?.user?.id}
        />
      </div>
    </div>
  )
}
