/**
 * @module components/post/ScheduledPostList
 */

'use client'

import { useState } from 'react'
import { ScheduledPostCard } from './ScheduledPostCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'

type ScheduledPostStatus = 'pending' | 'published' | 'failed' | 'cancelled'

type ScheduledPost = {
  id: string
  content: string | null
  scheduledAt: Date
  status: ScheduledPostStatus
  createdAt: Date
  publishedPostId: string | null
  media: { url: string; type: string }[]
  genres: { genre: { id: string; name: string } }[]
}

type ScheduledPostListProps = {
  scheduledPosts: ScheduledPost[]
}

export function ScheduledPostList({ scheduledPosts }: ScheduledPostListProps) {

  const [activeTab, setActiveTab] = useState<string>('pending')

  const pendingPosts = scheduledPosts.filter(p => p.status === SCHEDULED_POST_STATUS.PENDING)
  const publishedPosts = scheduledPosts.filter(p => p.status === SCHEDULED_POST_STATUS.PUBLISHED)
  const otherPosts = scheduledPosts.filter(p => p.status === SCHEDULED_POST_STATUS.FAILED || p.status === SCHEDULED_POST_STATUS.CANCELLED)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="pending">
          予約中 ({pendingPosts.length})
        </TabsTrigger>
        <TabsTrigger value="published">
          公開済み ({publishedPosts.length})
        </TabsTrigger>
        <TabsTrigger value="other">
          その他 ({otherPosts.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="space-y-4">
        {pendingPosts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            予約中の投稿はありません
          </p>
        ) : (
          pendingPosts.map(post => (
            <ScheduledPostCard key={post.id} post={post} />
          ))
        )}
      </TabsContent>

      <TabsContent value="published" className="space-y-4">
        {publishedPosts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            公開済みの予約投稿はありません
          </p>
        ) : (
          publishedPosts.map(post => (
            <ScheduledPostCard key={post.id} post={post} />
          ))
        )}
      </TabsContent>

      <TabsContent value="other" className="space-y-4">
        {otherPosts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            失敗・キャンセルされた投稿はありません
          </p>
        ) : (
          otherPosts.map(post => (
            <ScheduledPostCard key={post.id} post={post} />
          ))
        )}
      </TabsContent>
    </Tabs>
  )
}
