/**
 * @file 盆栽詳細ページコンポーネント
 * @description 特定の盆栽の詳細情報と成長記録を表示するページ
 *              - 盆栽の基本情報（名前、樹種、説明、入手日）の表示
 *              - 成長記録のタイムライン表示
 *              - オーナーには編集、削除、成長記録追加機能を提供
 *              - 関連する投稿もタイムラインに統合表示
 */

// Next.js のnotFound関数 - 盆栽が見つからない場合に404ページを表示
import { notFound } from 'next/navigation'

// Next.js のMetadata型 - 動的メタデータ生成用
import { Metadata } from 'next'

// NextAuth.js の認証関数 - 現在のセッション情報を取得（オーナー判定用）
import { auth } from '@/lib/auth'

// 盆栽詳細を取得するServer Action
import { getBonsai } from '@/lib/actions/bonsai'

// 盆栽に関連する投稿を取得するServer Action
import { getPostsByBonsai } from '@/lib/actions/post'

// Next.js のLink コンポーネント - ナビゲーション用
import Link from 'next/link'

// Next.js のImage コンポーネント - 最適化された盆栽画像表示
import Image from 'next/image'

// 成長記録追加フォームコンポーネント - 新しい成長記録を登録
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'

// 盆栽アクションメニューコンポーネント - 編集、削除等のドロップダウンメニュー
import { BonsaiActions } from '@/components/bonsai/BonsaiActions'

// 盆栽タイムラインコンポーネント - 成長記録と投稿の時系列表示
import { BonsaiTimeline } from '@/components/bonsai/BonsaiTimeline'
// 制限値定数
import { BONSAI_DESCRIPTION_PREVIEW_LENGTH } from '@/lib/constants/limits'
// ルート定数
import { BASE_URL, ROUTE_BONSAI } from '@/lib/constants/routes'
// SEO 用 JSON-LD
import { ArticleJsonLd } from '@/components/seo/JsonLd'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

/**
 * ページプロパティの型定義
 * Next.js 15以降ではparamsはPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * 動的メタデータ生成関数
 * 盆栽情報に基づいてSEO用のメタデータを生成する
 *
 * @param params - 動的ルートパラメータ（盆栽ID）
 * @returns メタデータオブジェクト（タイトル、説明、OGP情報）
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await getBonsai(id)

  // 盆栽が見つからない場合のフォールバック
  if (!result.success || !result.data?.bonsai) {
    return { title: '盆栽が見つかりません' }
  }

  const bonsai = result.data.bonsai
  const title = `${bonsai.name} - マイ盆栽`
  // 説明文を動的に生成（樹種、説明を含む）
  const description = bonsai.description
    ? `${bonsai.species ? `${bonsai.species}の` : ''}盆栽「${bonsai.name}」${bonsai.description.slice(0, BONSAI_DESCRIPTION_PREVIEW_LENGTH)}${bonsai.description.length > BONSAI_DESCRIPTION_PREVIEW_LENGTH ? '...' : ''}`
    : `${bonsai.species ? `${bonsai.species}の` : ''}盆栽「${bonsai.name}」の成長記録`

  // 最新の成長記録画像をOG画像として使用
  const latestImage = bonsai.records?.[0]?.images?.[0]?.url
  const ogImage = latestImage || '/api/og'

  return {
    title,
    description,
    // Open Graph（SNSシェア用）メタデータ
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${BASE_URL}/bonsai/${id}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: bonsai.name,
        },
      ],
    },
    // Twitterカード用メタデータ
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    // 正規URLを指定（重複コンテンツ対策）
    alternates: {
      canonical: `${BASE_URL}/bonsai/${id}`,
    },
  }
}

/**
 * 戻る矢印アイコンコンポーネント
 *
 * @description
 * マイ盆栽一覧ページへ戻るリンクに使用するSVGアイコン
 *
 * @param className - 追加のCSSクラス
 * @returns SVGアイコンのJSX
 */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

/**
 * 盆栽アイコンコンポーネント
 *
 * @description
 * 盆栽画像がない場合のフォールバック表示に使用するSVGアイコン
 *
 * @param className - 追加のCSSクラス
 * @returns SVGアイコンのJSX
 */
function TreeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v18" />
      <path d="M8 7a4 4 0 0 1 8 0c0 2-2 3-4 3S8 9 8 7Z" />
      <path d="M6 12a4 4 0 0 1 12 0c0 2-3 3-6 3s-6-1-6-3Z" />
    </svg>
  )
}

/**
 * カレンダーアイコンコンポーネント
 *
 * @description
 * 入手日の表示に使用するSVGアイコン
 *
 * @param className - 追加のCSSクラス
 * @returns SVGアイコンのJSX
 */
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

/**
 * 盆栽詳細ページのメインコンポーネント
 *
 * @description
 * - URLパラメータから盆栽IDを取得
 * - 盆栽詳細と関連投稿を並列で取得
 * - 盆栽が見つからない場合は404ページを表示
 * - オーナーには編集、削除、成長記録追加機能を表示
 *
 * @param params - ルートパラメータ（id）
 * @returns 盆栽詳細ページのJSX
 */
export default async function BonsaiDetailPage({ params }: Props) {
  // ルートパラメータから盆栽IDを取得
  const { id } = await params

  // 現在のセッション情報を取得（オーナー判定用）
  const session = await auth()

  // 盆栽詳細と関連投稿を並列で取得（パフォーマンス最適化）
  const [result, postsResult] = await Promise.all([
    getBonsai(id),
    getPostsByBonsai(id),
  ])

  // 盆栽が見つからない場合は404ページを表示
  if (!result.success || !result.data?.bonsai) {
    notFound()
  }

  // 取得結果からデータを抽出
  const bonsai = result.data.bonsai
  const relatedPosts = postsResult.success ? (postsResult.data?.posts ?? []) : []

  // 現在のユーザーがオーナーかどうかを判定
  const isOwner = session?.user?.id === bonsai.userId

  // 最新の成長記録画像を取得（メイン画像として表示）
  const latestImage = bonsai.records?.[0]?.images?.[0]?.url

  const canonicalUrl = `${BASE_URL}/bonsai/${id}`
  const bonsaiDescription = bonsai.description
    ? bonsai.description.slice(0, BONSAI_DESCRIPTION_PREVIEW_LENGTH)
    : `${bonsai.species ? `${bonsai.species}の` : ''}盆栽「${bonsai.name}」の成長記録`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* SEO 用構造化データ: 成長記録コンテンツを Article として表現 */}
      <ArticleJsonLd
        headline={bonsai.name}
        datePublished={new Date(bonsai.createdAt).toISOString()}
        dateModified={new Date(bonsai.updatedAt).toISOString()}
        author={{
          name: bonsai.user.nickname,
          url: `${BASE_URL}/users/${bonsai.user.id}`,
        }}
        url={canonicalUrl}
        image={latestImage}
        description={bonsaiDescription}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'ホーム', url: `${BASE_URL}/feed` },
          { name: 'マイ盆栽', url: `${BASE_URL}${ROUTE_BONSAI}` },
          { name: bonsai.name, url: canonicalUrl },
        ]}
      />
      {/* ヘッダーと基本情報カード */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {/* ナビゲーションバー - 戻るリンクとアクションメニュー */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <Link href={ROUTE_BONSAI} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            マイ盆栽に戻る
          </Link>

          {/* オーナーのみアクションメニュー（編集、削除）を表示 */}
          {isOwner && <BonsaiActions bonsaiId={id} bonsaiName={bonsai.name} />}
        </div>

        {/* メイン画像エリア */}
        <div className="aspect-video bg-muted relative">
          {latestImage ? (
            // 最新の成長記録画像を表示
            <Image
              src={latestImage}
              alt={bonsai.name}
              fill
              className="object-cover"
            />
          ) : (
            // 画像がない場合はフォールバックアイコンを表示
            <div className="w-full h-full flex items-center justify-center">
              <TreeIcon className="w-24 h-24 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* 基本情報セクション */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              {/* 盆栽名 */}
              <h1 className="text-2xl font-bold">{bonsai.name}</h1>

              {/* 樹種（オプション） */}
              {bonsai.species && (
                <p className="text-muted-foreground">{bonsai.species}</p>
              )}
            </div>
          </div>

          {/* 説明文（オプション） */}
          {bonsai.description && (
            <p className="mt-4 text-muted-foreground">{bonsai.description}</p>
          )}

          {/* メタ情報（入手日、記録数、投稿数） */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {/* 入手日の表示 */}
            {bonsai.acquiredAt && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                <span>入手: {new Date(bonsai.acquiredAt).toLocaleDateString('ja-JP')}</span>
              </div>
            )}

            {/* 成長記録数と投稿数 */}
            <span>{bonsai._count?.records || 0}件の成長記録 / {relatedPosts.length}件の投稿</span>
          </div>
        </div>
      </div>

      {/* 成長記録追加フォーム - オーナーのみ表示 */}
      {isOwner && (
        <div className="bg-card rounded-lg border">
          <h2 className="px-4 py-3 font-bold border-b">成長記録を追加</h2>
          <div className="p-4">
            <BonsaiRecordForm bonsaiId={id} />
          </div>
        </div>
      )}

      {/* タイムラインセクション - 成長記録と投稿を時系列で表示 */}
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
