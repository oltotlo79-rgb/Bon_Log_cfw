/**
 * @file ShopList.tsx
 * @description 盆栽園一覧表示コンポーネント
 *
 * 機能概要:
 * - 盆栽園データの配列を受け取り、グリッドレイアウトで一覧表示する
 * - 盆栽園が0件の場合は空状態のメッセージを表示する
 * - 各盆栽園はShopCardコンポーネントでカード形式で表示される
 *
 * 使用例:
 * ```tsx
 * import { ShopList } from '@/components/shop/ShopList'
 *
 * // 盆栽園一覧ページでの使用
 * <ShopList shops={shops} />
 * ```
 *
 * レスポンシブ対応:
 * - モバイル: 1カラム
 * - sm以上: 2カラム
 * - lg以上: 1カラム
 * - xl以上: 2カラム
 */
'use client'

// 盆栽園カードコンポーネントをインポート
// 各盆栽園の情報をカード形式で表示する
import { Fragment } from 'react'
import { ShopCard } from './ShopCard'
import { InFeedAdSlot } from '@/components/ads'
import { SHOPS_AD_INTERVAL } from '@/lib/constants/limits'

/**
 * ジャンル情報の型定義
 * 盆栽園が取り扱う樹種や商品カテゴリを表す
 */
interface Genre {
  /** ジャンルの一意識別子 */
  id: string
  /** ジャンル名（例: 松柏類、雑木類） */
  name: string
  /** ジャンルが属するカテゴリ（例: 樹種、用品） */
  category: string
}

/**
 * 盆栽園情報の型定義
 * 一覧表示に必要な盆栽園の基本情報を定義
 */
interface Shop {
  /** 盆栽園の一意識別子 */
  id: string
  /** 盆栽園の名称 */
  name: string
  /** 盆栽園の住所 */
  address: string
  /** 電話番号（任意） */
  phone?: string | null
  /** ウェブサイトURL（任意） */
  website?: string | null
  /** 営業時間（任意、例: "9:00〜17:00"） */
  businessHours?: string | null
  /** 定休日（任意、例: "水曜日"） */
  closedDays?: string | null
  /** 取り扱いジャンルの配列 */
  genres: Genre[]
  /** 平均評価（レビューがない場合はnull） */
  averageRating: number | null
  /** レビュー件数 */
  reviewCount: number
}

/**
 * ShopListコンポーネントのプロパティ定義
 */
interface ShopListProps {
  /** 表示する盆栽園の配列 */
  shops: Shop[]
}

/**
 * 地図ピンアイコンコンポーネント
 * 盆栽園が見つからない場合の空状態表示に使用
 *
 * @param className - 追加のCSSクラス名
 * @returns SVGアイコン要素
 */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/**
 * 盆栽園一覧表示コンポーネント
 *
 * 盆栽園の配列を受け取り、レスポンシブなグリッドレイアウトで表示する。
 * 盆栽園が0件の場合は、検索条件の変更や新規登録を促すメッセージを表示する。
 *
 * @param shops - 表示する盆栽園の配列
 * @returns 盆栽園一覧またはEmpty状態のUI
 */
export function ShopList({ shops }: ShopListProps) {
  // 盆栽園が0件の場合、空状態のメッセージを表示
  if (shops.length === 0) {
    return (
      <div className="text-center py-12">
        {/* アイコン表示エリア */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <MapPinIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        {/* メインメッセージ */}
        <h3 className="text-lg font-semibold mb-2">盆栽園が見つかりません</h3>
        {/* サブメッセージ */}
        <p className="text-muted-foreground">
          検索条件を変更するか、新しい盆栽園を登録してください
        </p>
      </div>
    )
  }

  // 盆栽園一覧をグリッドレイアウトで表示
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {shops.map((shop, index) => (
        <Fragment key={shop.id}>
          <ShopCard shop={shop} />
          <InFeedAdSlot
            index={index}
            total={shops.length}
            interval={SHOPS_AD_INTERVAL}
            className="col-span-full my-4"
          />
        </Fragment>
      ))}
    </div>
  )
}
