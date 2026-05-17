/**
 * このファイルは、タイムラインと投稿のローディング状態を表示する
 *
 * @module components/feed/TimelineSkeleton
 */

/**
 * タイムラインスケルトンコンポーネント
 *
 * タイムライン全体のローディング状態を表示
 * 3つの投稿カードスケルトンで構成
 *
 * ## 表示要素
 * - ユーザーアバター（丸型）
 * - ユーザー名、投稿日時のプレースホルダー
 * - 投稿本文のプレースホルダー（2行）
 * - 画像エリアのプレースホルダー
 * - アクションボタン（いいね、コメント等）のプレースホルダー
 *
 * ## アニメーション
 * - animate-pulse: Tailwind CSSの点滅アニメーション
 * - bg-muted: 薄いグレーの背景色
 *
 * @example
 * ```tsx
 * // React Queryのローディング状態で使用
 * const { isLoading } = useQuery({ ... })
 *
 * if (isLoading) {
 *   return <TimelineSkeleton />
 * }
 * ```
 */
export function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {/*
        3つの投稿カードスケルトンを生成
        [...Array(3)]で長さ3の配列を作り、mapで3回ループ
      */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4 space-y-3 animate-pulse">
          {/*
            ヘッダー部分
            - アバター画像（丸型、40x40px）
            - ユーザー名（幅96px）
            - 投稿日時（幅64px）
          */}
          <div className="flex items-center gap-3">
            {/* アバタープレースホルダー: 丸型のグレーボックス */}
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="space-y-2">
              {/* ユーザー名プレースホルダー */}
              <div className="h-4 w-24 bg-muted rounded" />
              {/* 投稿日時プレースホルダー */}
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>

          {/*
            コンテンツ部分
            - 投稿本文を模した2行のプレースホルダー
            - 1行目: 幅100%
            - 2行目: 幅75%（文章が途中で終わる感じを表現）
          */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>

          {/*
            画像プレースホルダー
            - 投稿画像エリアを模した大きな矩形
            - 高さ192px（h-48）で実際の画像サイズに近い
          */}
          <div className="h-48 w-full bg-muted rounded-lg" />

          {/*
            アクションボタン部分
            - いいね、コメント、共有等のボタンを模した小さな矩形
            - 3つのボタンプレースホルダー
          */}
          <div className="flex gap-4 pt-2">
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 個別投稿スケルトンコンポーネント
 *
 * 単一の投稿カードのローディング状態を表示
 * TimelineSkeletonより軽量で、画像エリアなしのシンプル版
 *
 * ## 表示要素
 * - ユーザーアバター
 * - ユーザー名、投稿日時
 * - 投稿本文（2行）
 *
 * ## 用途
 * - 投稿詳細ページのローディング
 * - 無限スクロールでの追加読み込み
 * - Suspenseのフォールバック
 *
 * @example
 * ```tsx
 * // 投稿詳細ページで使用
 * <Suspense fallback={<PostSkeleton />}>
 *   <PostDetail postId={id} />
 * </Suspense>
 *
 * // 条件付きレンダリングで使用
 * {isLoading ? <PostSkeleton /> : <PostCard post={post} />}
 * ```
 */
export function PostSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-4 space-y-3 animate-pulse">
      {/*
        ヘッダー部分
        - アバターとユーザー情報のプレースホルダー
      */}
      <div className="flex items-center gap-3">
        {/* アバタープレースホルダー */}
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="space-y-2">
          {/* ユーザー名プレースホルダー */}
          <div className="h-4 w-24 bg-muted rounded" />
          {/* 投稿日時プレースホルダー */}
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      </div>

      {/*
        コンテンツ部分
        - 投稿本文のプレースホルダー（2行）
        - 画像エリアは含まない軽量版
      */}
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-3/4 bg-muted rounded" />
      </div>
    </div>
  )
}
