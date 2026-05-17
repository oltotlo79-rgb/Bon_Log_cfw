/**
 * 通知一覧コンポーネント
 *
 * @module components/notification/NotificationList
 */

'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import Image from 'next/image'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'

/**
 * 個別の通知アイテムコンポーネント
 */
import { NotificationItem } from './NotificationItem'

/**
 * 通知関連のServer Actions
 * - getNotifications: 通知一覧の取得
 * - markAllAsRead: 全通知を既読にする
 */
import { getNotifications, markAllAsRead } from '@/lib/actions/notification'
import { DEFAULT_PAGE_LIMIT, SKELETON_COUNT, STALE_TIME_REALTIME_MS } from '@/lib/constants/limits'

import type { Notification } from './NotificationItem'

/**
 * NotificationListコンポーネントのprops型
 *
 * @property initialNotifications - サーバーサイドで取得した初期通知データ
 *                                  SSR時の初期表示に使用
 */
type NotificationListProps = {
  initialNotifications: Notification[]
}

/**
 * ベルアイコン（通知なし状態の表示用）
 *
 * @param className - 追加のCSSクラス
 * @returns ベルアイコンのSVG要素
 */
function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

/**
 * ダブルチェックアイコン（すべて既読にするボタン用）
 *
 * @param className - 追加のCSSクラス
 * @returns ダブルチェックアイコンのSVG要素
 */
function CheckCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </svg>
  )
}

/**
 * 通知一覧コンポーネント
 *
 * ## 機能
 * - 無限スクロールによる通知の追加読み込み
 * - ページ表示時に自動で全通知を既読化
 * - 未読通知がある場合は「すべて既読にする」ボタンを表示
 * - 通知がない場合は空状態メッセージを表示
 *
 * ## 無限スクロールの仕組み
 * 1. react-intersection-observer で末尾要素を監視
 * 2. 末尾がビューポートに入ったら fetchNextPage() を呼び出し
 * 3. カーソルベースのページネーションで次のデータを取得
 *
 * @param initialNotifications - サーバーサイドで取得した初期通知データ
 *
 * @example
 * ```tsx
 * <NotificationList
 *   initialNotifications={[
 *     { id: '1', type: 'like', isRead: false, ... },
 *     { id: '2', type: 'follow', isRead: true, ... },
 *   ]}
 * />
 * ```
 */
export function NotificationList({ initialNotifications }: NotificationListProps) {
  const queryClient = useQueryClient()

  /**
   * 無限スクロール用のReact Queryフック
   *
   * @property data - 取得した通知データ（ページ配列）
   * @property fetchNextPage - 次のページを取得する関数
   * @property hasNextPage - 次のページがあるかどうか
   * @property isFetchingNextPage - 次ページ取得中かどうか
   * @property isLoading - 初回読み込み中かどうか
   * @property refetch - データを再取得する関数
   */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    /**
     * キャッシュキー
     * 'notifications' というキーでキャッシュを管理
     */
    queryKey: ['notifications'],

    /**
     * データ取得関数
     * @param pageParam - カーソル（次のページの開始位置）
     */
    queryFn: async ({ pageParam }) => {
      return await getNotifications(pageParam)
    },

    /**
     * 初期ページパラメータ
     * 最初のページはカーソルなし（undefined）
     */
    initialPageParam: undefined as string | undefined,

    /**
     * 初期データ
     * SSRで取得したデータを初期値として設定
     * これによりハイドレーション時のちらつきを防止
     */
    initialData: {
      pages: [{
        notifications: initialNotifications as Awaited<ReturnType<typeof getNotifications>>['notifications'],
        /**
         * 次のカーソル
         * 20件取得した場合は最後のIDを次のカーソルとする
         */
        nextCursor: initialNotifications.length >= DEFAULT_PAGE_LIMIT ? initialNotifications[initialNotifications.length - 1]?.id : undefined,
      }],
      pageParams: [undefined],
    },

    /**
     * 次のページパラメータを取得
     * 最後のページからnextCursorを取得
     * undefinedの場合は次のページなし
     */
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: STALE_TIME_REALTIME_MS,
  })

  const { ref } = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage })

  /**
   * ページ表示時の自動既読処理
   *
   * 通知ページを開いた時点で全通知を既読にする
   * これはUXの観点から、ユーザーが通知を確認したとみなすため
   *
   * ## 処理フロー
   * 1. markAllAsRead() で全通知を既読に
   * 2. refetch() で通知一覧を再取得（既読状態を反映）
   * 3. キャッシュを無効化して未読バッジを更新
   */
  useEffect(() => {
    const autoMarkAsRead = async () => {
      // 全通知を既読にする
      await markAllAsRead()
      // UIを更新して既読状態を反映
      refetch()
      // 通知バッジのキャッシュも無効化して未読数を0にする
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
    }
    autoMarkAsRead()
  }, [refetch, queryClient])

  /**
   * 「すべて既読にする」ボタンのクリックハンドラ
   *
   * ## 処理内容
   * 1. Server Actionで全通知を既読に更新
   * 2. 通知一覧を再取得して既読状態を反映
   * 3. 未読数バッジのキャッシュを無効化
   */
  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
    refetch()
    // 通知バッジのキャッシュも無効化
    queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
  }

  /**
   * 初回読み込み中はスケルトンを表示
   */
  if (isLoading) {
    return <NotificationListSkeleton />
  }

  /**
   * 全ページの通知を1つの配列にフラット化
   */
  const allNotifications = data?.pages.flatMap((page) => page.notifications) || []

  /**
   * 未読通知があるかどうか
   * 「すべて既読にする」ボタンの表示制御に使用
   */
  const hasUnread = allNotifications.some((n) => !n.isRead)

  /**
   * 通知がない場合は空状態を表示
   */
  if (allNotifications.length === 0) {
    return (
      <div className="text-center py-12">
        {/* デコレーション画像 */}
        <Image src="/images/generated/placeholders/empty-notification.webp" alt="" width={192} height={144} className="mx-auto mb-4 opacity-60 empty-state-illustration" />
        {/* 空状態アイコン */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <BellIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        {/* 空状態メッセージ */}
        <h3 className="text-lg font-semibold mb-2">通知はありません</h3>
        <p className="text-muted-foreground">
          いいね、コメント、フォローなどの通知がここに表示されます
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* ============================================================ */}
      {/* ヘッダー: すべて既読にするボタン */}
      {/* ============================================================ */}
      {hasUnread && (
        <div className="flex justify-end p-2 border-b">
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <CheckCheckIcon className="w-4 h-4" />
            すべて既読にする
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 通知一覧 */}
      {/* ============================================================ */}
      <div>
        {allNotifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </div>

      {/* ============================================================ */}
      {/* 無限スクロール検知エリア */}
      {/* ============================================================ */}
      {/*
       * ref: この要素がビューポートに入ると inView が true になる
       * それにより useEffect で fetchNextPage() が呼ばれる
       */}
      <div ref={ref} className="py-4 flex justify-center">
        {/* 次ページ取得中のローディング表示 */}
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">読み込み中...</span>
          </div>
        )}
        {/* 全データ読み込み完了時のメッセージ */}
        {!hasNextPage && allNotifications.length > 0 && (
          <p className="text-sm text-muted-foreground">これ以上通知はありません</p>
        )}
      </div>
    </div>
  )
}

/**
 * 通知一覧のローディングスケルトン
 *
 * ## 用途
 * - 初回データ読み込み中に表示
 * - ユーザーに読み込み中であることを視覚的に伝える
 *
 * ## 表示内容
 * - 5件分のスケルトン
 * - アバター、テキスト2行のプレースホルダー
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <NotificationListSkeleton />
 * }
 * ```
 */
function NotificationListSkeleton() {
  return (
    <div>
      {/* スケルトンを表示 */}
      {[...Array(SKELETON_COUNT)].map((_, i) => (
        <div key={i} className="flex gap-3 p-4 border-b animate-pulse">
          {/* アバタースケルトン */}
          <div className="w-10 h-10 rounded-full bg-muted" />
          {/* テキストスケルトン */}
          <div className="flex-1 space-y-2">
            {/* メッセージ行 */}
            <div className="h-4 w-3/4 bg-muted rounded" />
            {/* 時刻行 */}
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
