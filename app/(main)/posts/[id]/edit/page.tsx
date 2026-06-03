import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getMembershipLimits } from '@/lib/premium'
import { getGenres } from '@/lib/actions/post'
import { PostEditForm } from '@/components/post/PostEditForm'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { buildPostPath } from '@/lib/constants/path-builders'

export const metadata = {
  title: '投稿を編集 | BON-LOG',
  // 編集ページは所有者専用のため検索エンジンに公開しない
  robots: { index: false, follow: false },
}

/**
 * 編集可能な投稿（自分の投稿・純粋リポストでない）を取得する。
 * 純粋リポスト（repostPostId 有り）は本文を持たないため除外する。
 */
async function getEditablePost(id: string, userId: string) {
  return prisma.post.findFirst({
    where: { id, userId, repostPostId: null },
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      genres: true,
    },
  })
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const post = await getEditablePost(id, session.user.id)
  if (!post) {
    // 存在しない / 他人の投稿 / 純粋リポストは編集不可
    notFound()
  }

  const genresResult = await getGenres()
  const genres = genresResult.genres || {}
  const limits = await getMembershipLimits(session.user.id)

  const editData = {
    id: post.id,
    content: post.content,
    genreIds: post.genres.map((g: { genreId: string }) => g.genreId),
    media: post.media.map((m: { url: string; type: string }) => ({ url: m.url, type: m.type })),
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <div className="flex items-center gap-4 mb-4">
        <Link href={buildPostPath(post.id)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">投稿を編集</h1>
      </div>

      <PostEditForm genres={genres} limits={limits} editData={editData} />
    </div>
  )
}
