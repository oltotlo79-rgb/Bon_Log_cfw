/**
 * このファイルは、タイムラインに表示する投稿がない場合の
 *
 * @module components/feed/EmptyTimeline
 */

/**
 * Next.js Link コンポーネント
 * クライアントサイドナビゲーションを実現
 * ページ遷移時にフルリロードせず高速に移動
 */
import Image from 'next/image'
import Link from 'next/link'
import { ROUTE_SEARCH } from '@/lib/constants/routes'
import { ILLUSTRATION_WIDTH, ILLUSTRATION_HEIGHT } from '@/lib/constants/limits'

/**
 * ユーザーグループアイコンコンポーネント
 *
 * 複数のユーザーを表すSVGアイコン
 * フォロー/ソーシャル機能を示唆するデザイン
 *
 * ## アイコンの構成
 * - 左側に2人のユーザー（メインユーザー）
 * - 右側に1人のユーザー（追加ユーザー）
 *
 * @param className - 追加するCSSクラス（サイズ、色等）
 *
 * @example
 * ```tsx
 * <UsersIcon className="w-8 h-8 text-muted-foreground" />
 * ```
 */
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 左側のユーザー: 体（肩から下） */}
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      {/* 左側のユーザー: 頭（丸型） */}
      <circle cx="9" cy="7" r="4" />
      {/* 右側のユーザー: 体（肩から下、部分的に表示） */}
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      {/* 右側のユーザー: 頭（半円として表示） */}
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

/**
 * 検索アイコンコンポーネント
 *
 * 虫眼鏡を模したSVGアイコン
 * 検索機能を示すデザイン
 *
 * ## アイコンの構成
 * - 円形のレンズ部分
 * - 斜めのハンドル部分
 *
 * @param className - 追加するCSSクラス（サイズ、色等）
 *
 * @example
 * ```tsx
 * <SearchIcon className="w-4 h-4" />
 * ```
 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 虫眼鏡のレンズ部分（円） */}
      <circle cx="11" cy="11" r="8" />
      {/* 虫眼鏡のハンドル部分（斜めの線） */}
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/**
 * 空のタイムラインコンポーネント
 *
 * タイムラインに投稿がない場合に表示される
 * ユーザーにフォローを促すガイダンスUI
 *
 * ## レイアウト構造
 * ```
 * ┌─────────────────────────────────┐
 * │           [アイコン]              │
 * │                                 │
 * │   タイムラインに投稿がありません    │
 * │                                 │
 * │   ユーザーをフォローすると、      │
 * │   その人の投稿がここに表示されます  │
 * │                                 │
 * │       [ユーザーを検索]           │
 * └─────────────────────────────────┘
 * ```
 *
 * ## デザイン特徴
 * - 中央揃えのシンプルなレイアウト
 * - アイコン + テキスト + CTAボタンの構成
 * - カード風のデザイン（border + 背景色）
 *
 * ## ユーザー体験
 * - 新規ユーザーが最初に見る可能性が高い
 * - 明確なアクション（検索ページへ誘導）を提示
 * - フレンドリーで親しみやすいメッセージ
 *
 * @example
 * ```tsx
 * // Timelineコンポーネント内での使用
 * if (allPosts.length === 0) {
 *   return <EmptyTimeline />
 * }
 *
 * // Server Componentでの使用
 * export default async function FeedPage() {
 *   const posts = await getTimeline()
 *
 *   if (posts.length === 0) {
 *     return <EmptyTimeline />
 *   }
 *
 *   return <Timeline posts={posts} />
 * }
 * ```
 */
export function EmptyTimeline() {
  return (
    <div className="bg-card rounded-lg border p-8 text-center">
      {/* デコレーション画像 */}
      <Image src="/images/generated/placeholders/empty-timeline.webp" alt="" width={ILLUSTRATION_WIDTH} height={ILLUSTRATION_HEIGHT} className="mx-auto mb-4 opacity-60 empty-state-illustration dark:hidden" />
      <Image src="/images/generated/placeholders/empty-timeline-dark.webp" alt="" width={ILLUSTRATION_WIDTH} height={ILLUSTRATION_HEIGHT} className="mx-auto mb-4 opacity-60 empty-state-illustration hidden dark:block" />
      {/*
        アイコンエリア
        - 丸い背景の中にユーザーグループアイコン
        - フォロー/ソーシャル機能を視覚的に表現
      */}
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <UsersIcon className="w-8 h-8 text-muted-foreground" />
      </div>

      {/*
        メインメッセージ
        - 現在の状態を明確に伝える見出し
        - font-semiboldで強調
      */}
      <h3 className="text-lg font-semibold mb-2">タイムラインに投稿がありません</h3>

      {/*
        サブメッセージ
        - 状態の理由と解決方法を説明
        - 穏やかな色（text-muted-foreground）で表示
      */}
      <p className="text-muted-foreground mb-6">
        ユーザーをフォローすると、その人の投稿がここに表示されます
      </p>

      {/*
        アクションボタンエリア
        - ユーザーを検索ページへ誘導するボタン
        - レスポンシブ: モバイルで縦並び、sm以上で横並び
      */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {/*
          検索ページへのリンクボタン
          - プライマリカラーで目立たせる
          - アイコン + テキストの構成
          - ホバー時に少し暗くなる
        */}
        <Link
          href={ROUTE_SEARCH}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <SearchIcon className="w-4 h-4" />
          ユーザーを検索
        </Link>
      </div>
    </div>
  )
}
