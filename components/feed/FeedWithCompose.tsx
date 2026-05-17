'use client'

import { useState } from 'react'
import { Pen as PenIcon } from 'lucide-react'
import { Timeline } from './Timeline'
import { PostFormModal } from '@/components/post/PostFormModal'
import type { Post } from '@/components/post/PostCard.types'

type Genre = {
  id: string
  name: string
  category: string
}

type MembershipLimits = {
  maxPostLength: number
  maxImages: number
  maxVideos: number
  canSchedulePost: boolean
  canViewAnalytics: boolean
}

type Bonsai = {
  id: string
  name: string
  species: string | null
}

type FeedWithComposeProps = {
  initialPosts: Post[]
  currentUserId?: string
  genres: Record<string, Genre[]>
  limits: MembershipLimits
  draftCount?: number
  bonsais?: Bonsai[]
}

export function FeedWithCompose({
  initialPosts,
  currentUserId,
  genres,
  limits,
  draftCount = 0,
  bonsais = [],
}: FeedWithComposeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="relative min-h-screen">
      <div>
        <h2 className="text-lg font-bold mb-4">タイムライン</h2>
        <Timeline initialPosts={initialPosts} currentUserId={currentUserId} />
      </div>

      {/*
        FAB をスクロール追従させつつコンテナはクリック透過 (pointer-events-none) させ、
        ボタンだけ pointer-events-auto に戻すことで背後の投稿ホバー領域を奪わないようにする。
        bottom-20 はモバイルのボトムナビと FAB を重ねないための余白。
      */}
      <div className="sticky bottom-20 md:bottom-6 pointer-events-none z-40">
        <div className="flex justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="pointer-events-auto w-14 h-14 bg-bonsai-green hover:bg-bonsai-green/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
            aria-label="新規投稿"
          >
            <PenIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      <PostFormModal
        genres={genres}
        limits={limits}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        draftCount={draftCount}
        bonsais={bonsais}
      />
    </div>
  )
}
