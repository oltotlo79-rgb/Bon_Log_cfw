/**
 * @file 投稿が見つからない場合の404ページ
 * @description 存在しない投稿IDにアクセスした場合に表示されるUI
 *
 * このファイルはNext.js App Routerの規約に基づくnot-foundページです。
 * notFound()関数が呼び出された際に自動的に表示されます。
 *
 * 表示されるケース:
 * - 削除された投稿へのアクセス
 * - 存在しない投稿IDへのアクセス
 * - 非公開投稿への権限のないアクセス
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/not-found
 */

// Next.jsのリンクコンポーネント
// タイムラインへの戻りリンクに使用
import Link from 'next/link'

// shadcn/uiのボタンコンポーネント
// スタイル付きの戻るボタンに使用
import { Button } from '@/components/ui/button'

/**
 * 投稿Not Foundコンポーネント
 *
 * 投稿が見つからない場合に表示されるServer Componentです。
 * ユーザーフレンドリーなメッセージとタイムラインへの導線を提供します。
 *
 * @returns 404表示UIのJSX要素
 */
export default function PostNotFound() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border p-8 text-center">
        {/* メインメッセージ */}
        <h1 className="text-2xl font-bold mb-2">投稿が見つかりません</h1>

        {/* 補足説明 - 考えられる原因を説明 */}
        <p className="text-muted-foreground mb-6">
          この投稿は削除されたか、存在しない可能性があります。
        </p>

        {/* タイムラインへ戻るボタン
            asChildプロパティでLinkコンポーネントをButton内に配置 */}
        <Button asChild>
          <Link href="/feed">タイムラインに戻る</Link>
        </Button>
      </div>
    </div>
  )
}
