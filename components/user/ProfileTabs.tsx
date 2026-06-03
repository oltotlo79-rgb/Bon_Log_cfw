'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { COMMENT_PREVIEW_LENGTH, PROFILE_POSTS_AD_INTERVAL } from '@/lib/constants/limits'
import { InFeedAdSlot } from '@/components/ads'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PostCard } from '@/components/post/PostCard'
import type { Post } from '@/components/post/PostCard.types'
import { buildPostPath } from '@/lib/constants/path-builders'

type UserComment = {
  id: string
  content: string
  createdAt: Date
  post: { id: string; content: string | null }
  media: { id: string; url: string; type: string; sortOrder: number }[]
}

type ProfileTabsProps = {
  posts: Post[]
  comments: UserComment[]
  currentUserId?: string
}

export function ProfileTabs({ posts, comments, currentUserId }: ProfileTabsProps) {
  return (
    <div className="bg-card rounded-lg border">
      <Tabs defaultValue="posts">
        <TabsList className="w-full rounded-none rounded-t-lg border-b bg-transparent p-0 h-auto">
          <TabsTrigger
            value="posts"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            投稿
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            コメント
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {posts.length > 0 ? (
            <div className="divide-y">
              {posts.map((post, index) => (
                <Fragment key={post.id}>
                  <PostCard
                    post={post}
                    currentUserId={currentUserId}
                  />
                  <InFeedAdSlot
                    index={index}
                    total={posts.length}
                    interval={PROFILE_POSTS_AD_INTERVAL}
                  />
                </Fragment>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-muted-foreground">
              まだ投稿がありません
            </p>
          )}
        </TabsContent>

        <TabsContent value="comments">
          {comments.length > 0 ? (
            <div className="divide-y">
              {comments.map((comment) => (
                <div key={comment.id} className="p-4 space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

                  {comment.media.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {comment.media.map((m) => (
                        <div key={m.id} className="relative w-20 h-20 rounded overflow-hidden">
                          {m.type === 'image' ? (
                            <Image
                              src={m.url}
                              alt="投稿画像"
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            <video src={m.url} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <time>
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </time>
                    <span>·</span>
                    <Link
                      href={buildPostPath(comment.post.id)}
                      className="hover:underline truncate max-w-[300px]"
                    >
                      {comment.post.content
                        ? `「${comment.post.content.slice(0, COMMENT_PREVIEW_LENGTH)}${comment.post.content.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}」への返信`
                        : '投稿への返信'}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-8 text-center text-muted-foreground">
              まだコメントがありません
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
