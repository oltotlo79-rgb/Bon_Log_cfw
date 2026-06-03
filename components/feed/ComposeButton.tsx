/**
 * このコンポーネントは、画面右下に表示されるフローティングアクションボタン（FAB）と
 *
 * @module components/feed/ComposeButton
 */

'use client'

import { useState } from 'react'
import { PostFormModal } from '@/components/post/PostFormModal'

/**
 * ジャンルの型
 */
type Genre = {
  id: string
  name: string
  category: string
}

/**
 * 会員種別による投稿制限の型
 */
type MembershipLimits = {
  maxPostLength: number
  maxImages: number
  maxVideos: number
  canSchedulePost: boolean
  canViewAnalytics: boolean
}

/**
 * 盆栽の型
 */
type Bonsai = {
  id: string
  name: string
  species: string | null
}

/**
 * ComposeButtonコンポーネントのprops型
 */
type ComposeButtonProps = {
  genres: Record<string, Genre[]>
  limits: MembershipLimits
  draftCount?: number
  bonsais?: Bonsai[]
}

/**
 * ペンアイコンコンポーネント
 */
function PenIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}

/**
 * 投稿作成ボタンコンポーネント
 *
 * フローティングアクションボタン（FAB）と投稿モーダルを提供。
 * タイムラインとは独立してレンダリングされるため、
 * Suspenseと組み合わせてUXを向上できます。
 *
 * @param genres - カテゴリ別ジャンル一覧
 * @param limits - 会員種別による投稿制限
 * @param draftCount - 下書き件数
 * @param bonsais - ユーザーの盆栽一覧
 */
export function ComposeButton({
  genres,
  limits,
  draftCount = 0,
  bonsais = [],
}: ComposeButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <div className="sticky bottom-20 md:bottom-6 pointer-events-none z-40">
        <div className="flex justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="pointer-events-auto w-20 h-20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-washi-lg flex items-center justify-center transition-all hover:scale-105 btn-washi"
            aria-label="投稿を作成"
            data-compose-button
            data-testid="compose-button"
          >
            <PenIcon className="w-8 h-8" />
          </button>
        </div>
      </div>

      <PostFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        genres={genres}
        limits={limits}
        draftCount={draftCount}
        bonsais={bonsais}
      />
    </>
  )
}
