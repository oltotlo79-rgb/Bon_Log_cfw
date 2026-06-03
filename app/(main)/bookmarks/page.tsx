// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

// ブックマーク済み投稿を取得するServer Action
import { getBookmarkedPosts } from '@/lib/actions/bookmark'

// ブックマーク投稿リストのクライアントコンポーネント - 無限スクロールを実装
import { BookmarkPostList } from './BookmarkPostList'

import { ROUTE_LOGIN } from '@/lib/constants/routes'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: 'ブックマーク',
  robots: { index: false, follow: false },
}

/**
 * ブックマークページのメインコンポーネント
 *
 *
 * @returns ブックマークページのJSX
 */
export default async function BookmarksPage() {
  // 現在のセッション情報を取得（proxyで認証済み）
  // proxy.ts の PROTECTED_PATHS により未認証アクセスは事前に弾かれるが、
  // 防御層として明示的にリダイレクトし、TypeScript の narrowing も得る。
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // ブックマーク済み投稿を取得（初期表示分）
  const result = await getBookmarkedPosts()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden">
        <h1 className="px-4 py-3 font-bold border-b">ブックマーク</h1>

        <BookmarkPostList
          initialPosts={result.posts || []}
          initialNextCursor={result.nextCursor}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  )
}
