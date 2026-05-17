/**
 * 予約投稿一覧コンポーネント
 *
 * @module components/post/ScheduledPostList
 */

'use client'

/**
 * React useState Hook
 * アクティブなタブの状態を管理
 */
import { useState } from 'react'

/**
 * 予約投稿カードコンポーネント
 * 各予約投稿の詳細を表示するカード
 */
import { ScheduledPostCard } from './ScheduledPostCard'

/**
 * shadcn/uiのタブコンポーネント群
 *
 * Tabs: タブコンテナ
 * TabsContent: タブのコンテンツエリア
 * TabsList: タブボタンのリスト
 * TabsTrigger: 各タブのトリガーボタン
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'

/**
 * 予約投稿のステータス型
 *
 * @value 'pending' - 予約中（まだ公開されていない）
 * @value 'published' - 公開済み（予定時刻に正常に公開された）
 * @value 'failed' - 失敗（公開処理でエラーが発生した）
 * @value 'cancelled' - キャンセル（ユーザーが予約を取り消した）
 */
type ScheduledPostStatus = 'pending' | 'published' | 'failed' | 'cancelled'

/**
 * 予約投稿の型
 *
 * @property id - 予約投稿の一意識別子
 * @property content - 投稿テキスト（null可、画像のみの投稿もあり）
 * @property scheduledAt - 公開予定日時
 * @property status - 予約投稿のステータス
 * @property createdAt - 予約投稿の作成日時
 * @property publishedPostId - 公開後の投稿ID（公開済みの場合のみ）
 * @property media - 添付メディアの配列（URLと種類）
 * @property genres - 投稿に関連付けられたジャンル情報
 */
type ScheduledPost = {
  /** 予約投稿の一意識別子 */
  id: string
  /** 投稿テキスト（画像のみの場合はnull） */
  content: string | null
  /** 公開予定日時 */
  scheduledAt: Date
  /** 予約投稿のステータス */
  status: ScheduledPostStatus
  /** 予約投稿の作成日時 */
  createdAt: Date
  /** 公開済みの場合、実際の投稿ID */
  publishedPostId: string | null
  /** 添付メディアの配列 */
  media: { url: string; type: string }[]
  /** 関連付けられたジャンル情報 */
  genres: { genre: { id: string; name: string } }[]
}

/**
 * ScheduledPostListコンポーネントのprops型
 *
 * @property scheduledPosts - 表示する予約投稿の配列
 */
type ScheduledPostListProps = {
  /** 表示する予約投稿の配列 */
  scheduledPosts: ScheduledPost[]
}

/**
 * 予約投稿一覧コンポーネント
 *
 * ## 機能
 * - タブでステータス別に予約投稿を表示
 * - 各タブに投稿数をカウント表示
 * - 投稿がない場合は空メッセージを表示
 *
 * ## タブ構成
 * 1. 予約中: 公開待ちの予約投稿
 * 2. 公開済み: 正常に公開された投稿
 * 3. その他: 失敗またはキャンセルされた投稿
 *
 * @param scheduledPosts - 予約投稿の配列
 *
 * @example
 * ```tsx
 * <ScheduledPostList
 *   scheduledPosts={[
 *     {
 *       id: '1',
 *       content: '明日公開予定の投稿です',
 *       scheduledAt: new Date('2024-01-01T10:00:00'),
 *       status: 'pending',
 *       createdAt: new Date(),
 *       publishedPostId: null,
 *       media: [],
 *       genres: [],
 *     },
 *   ]}
 * />
 * ```
 */
export function ScheduledPostList({ scheduledPosts }: ScheduledPostListProps) {

  /**
   * 現在アクティブなタブ
   *
   * 初期値は 'pending'（予約中タブ）
   * タブクリック時に更新される
   */
  const [activeTab, setActiveTab] = useState<string>('pending')

  /**
   * 予約中の投稿
   * まだ公開されていない、待機中の投稿
   */
  const pendingPosts = scheduledPosts.filter(p => p.status === SCHEDULED_POST_STATUS.PENDING)

  /**
   * 公開済みの投稿
   * 予定時刻に正常に公開された投稿
   */
  const publishedPosts = scheduledPosts.filter(p => p.status === SCHEDULED_POST_STATUS.PUBLISHED)

  /**
   * その他の投稿
   * 失敗またはキャンセルされた投稿
   */
  const otherPosts = scheduledPosts.filter(p => p.status === SCHEDULED_POST_STATUS.FAILED || p.status === SCHEDULED_POST_STATUS.CANCELLED)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* タブリスト（3カラムのグリッドレイアウト） */}
      <TabsList className="grid w-full grid-cols-3 mb-4">
        {/* 予約中タブ */}
        <TabsTrigger value="pending">
          予約中 ({pendingPosts.length})
        </TabsTrigger>
        {/* 公開済みタブ */}
        <TabsTrigger value="published">
          公開済み ({publishedPosts.length})
        </TabsTrigger>
        {/* その他タブ（失敗/キャンセル） */}
        <TabsTrigger value="other">
          その他 ({otherPosts.length})
        </TabsTrigger>
      </TabsList>

      {/* 予約中タブのコンテンツ */}
      <TabsContent value="pending" className="space-y-4">
        {pendingPosts.length === 0 ? (
          /* 空状態のメッセージ */
          <p className="text-center py-8 text-muted-foreground">
            予約中の投稿はありません
          </p>
        ) : (
          /* 予約投稿カードの一覧 */
          pendingPosts.map(post => (
            <ScheduledPostCard key={post.id} post={post} />
          ))
        )}
      </TabsContent>

      {/* 公開済みタブのコンテンツ */}
      <TabsContent value="published" className="space-y-4">
        {publishedPosts.length === 0 ? (
          /* 空状態のメッセージ */
          <p className="text-center py-8 text-muted-foreground">
            公開済みの予約投稿はありません
          </p>
        ) : (
          /* 公開済み投稿カードの一覧 */
          publishedPosts.map(post => (
            <ScheduledPostCard key={post.id} post={post} />
          ))
        )}
      </TabsContent>

      {/* その他タブのコンテンツ */}
      <TabsContent value="other" className="space-y-4">
        {otherPosts.length === 0 ? (
          /* 空状態のメッセージ */
          <p className="text-center py-8 text-muted-foreground">
            失敗・キャンセルされた投稿はありません
          </p>
        ) : (
          /* 失敗/キャンセル投稿カードの一覧 */
          otherPosts.map(post => (
            <ScheduledPostCard key={post.id} post={post} />
          ))
        )}
      </TabsContent>
    </Tabs>
  )
}
