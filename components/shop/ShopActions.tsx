/**
 * @file ShopActions.tsx
 * @description 盆栽園詳細ページのアクションボタンコンポーネント
 *
 * 機能概要:
 * - ユーザーの権限に応じて適切なアクションボタンを表示
 * - オーナー: 盆栽園の編集リンク
 * - ログインユーザー（非オーナー）: 情報修正リクエスト + 通報ボタン
 * - 未ログインユーザー: ボタン非表示
 * - 変更リクエストフォームのモーダル表示を管理
 *
 * 使用例:
 * ```tsx
 * <ShopActions
 *   shop={shopInfo}
 *   isOwner={false}
 *   isLoggedIn={true}
 * />
 * ```
 */
'use client'

// React hooks
// useState: 変更リクエストフォームの表示/非表示状態を管理
import { useState } from 'react'

// Next.jsのリンクコンポーネント
// オーナー向け編集ページへの遷移に使用
import Link from 'next/link'

// 盆栽園情報の変更リクエストフォームコンポーネント
// 非オーナーが情報の修正をリクエストする際に使用
import { ShopChangeRequestForm } from './ShopChangeRequestForm'

// 通報ボタンコンポーネント
// 不適切な盆栽園情報を通報する機能
import { ReportButton } from '@/components/report/ReportButton'

/**
 * 盆栽園情報の型定義
 * アクションボタンの表示と変更リクエストに必要な情報
 */
interface ShopInfo {
  /** 盆栽園の一意識別子 */
  id: string
  /** 盆栽園名 */
  name: string
  /** 住所 */
  address: string
  /** 電話番号（任意） */
  phone: string | null
  /** ウェブサイトURL（任意） */
  website: string | null
  /** 営業時間（任意） */
  businessHours: string | null
  /** 定休日（任意） */
  closedDays: string | null
}

/**
 * ShopActionsコンポーネントのプロパティ定義
 */
interface ShopActionsProps {
  /** 盆栽園の情報 */
  shop: ShopInfo
  /** 現在のユーザーがこの盆栽園のオーナーかどうか */
  isOwner: boolean
  /** 現在のユーザーがログインしているかどうか */
  isLoggedIn: boolean
}

/**
 * 編集アイコン（鉛筆）コンポーネント
 * オーナー向け編集ボタンに使用
 *
 * @param className - 追加のCSSクラス名
 */
function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

/**
 * メッセージアイコン（吹き出し）コンポーネント
 * 変更リクエストボタンに使用
 *
 * @param className - 追加のCSSクラス名
 */
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/**
 * 盆栽園アクションボタンコンポーネント
 *
 * ユーザーの権限レベルに応じて以下のアクションを提供:
 * - オーナー: 編集ページへのリンクボタン
 * - ログインユーザー（非オーナー）: 情報修正リクエスト + 通報ボタン
 * - 未ログインユーザー: ボタン非表示
 *
 * @param shop - 盆栽園の情報
 * @param isOwner - オーナーかどうか
 * @param isLoggedIn - ログイン状態
 */
export function ShopActions({ shop, isOwner, isLoggedIn }: ShopActionsProps) {
  // 変更リクエストフォームの表示状態を管理
  // true: モーダル表示、false: 非表示
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false)

  return (
    <>
      {/* アクションボタンエリア */}
      <div className="flex items-center gap-2">
        {isOwner ? (
          // オーナーには編集ボタンを表示
          // クリックすると盆栽園編集ページへ遷移
          <Link
            href={`/shops/${shop.id}/edit`}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
          >
            <EditIcon className="w-4 h-4" />
            <span>編集</span>
          </Link>
        ) : isLoggedIn ? (
          // 非オーナーのログインユーザーには変更リクエストボタンと通報ボタンを表示
          <>
            {/* 情報修正リクエストボタン */}
            <button
              onClick={() => setShowChangeRequestForm(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              <MessageSquareIcon className="w-4 h-4" />
              <span>情報の修正をリクエスト</span>
            </button>
            {/* 通報ボタン */}
            <ReportButton
              targetType="shop"
              targetId={shop.id}
              variant="text"
              className="px-3 py-2 border rounded-lg hover:bg-destructive/10"
            />
          </>
        ) : null}
        {/* 未ログインユーザーには何も表示しない */}
      </div>

      {/* 変更リクエストフォームモーダル */}
      {showChangeRequestForm && (
        <ShopChangeRequestForm
          shop={shop}
          onClose={() => setShowChangeRequestForm(false)}
        />
      )}
    </>
  )
}
