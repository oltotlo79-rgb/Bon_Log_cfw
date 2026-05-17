/**
 * ShopCard.tsx
 *
 * 盆栽園の情報をカード形式で表示するコンポーネント。
 * 盆栽園一覧ページなどで使用され、各盆栽園の基本情報（名前、住所、電話番号、営業時間、評価など）を
 * コンパクトに表示します。カードをクリックすると詳細ページに遷移します。
 */

'use client'

// Next.jsのLinkコンポーネント - ページ間のナビゲーションを提供
import Link from 'next/link'
// 星評価を表示するためのコンポーネント
import { StarRatingDisplay } from './StarRating'

/**
 * ジャンルの型定義
 * 盆栽園が取り扱う商品カテゴリを表す
 */
interface Genre {
  id: string        // ジャンルの一意識別子
  name: string      // ジャンル名（例: 松柏類、雑木類など）
  category: string  // ジャンルのカテゴリ（例: 盆栽、用品など）
}

/**
 * ShopCardコンポーネントのプロパティ型定義
 * 表示する盆栽園の情報を受け取る
 */
interface ShopCardProps {
  shop: {
    id: string                      // 盆栽園の一意識別子
    name: string                    // 盆栽園の名前
    address: string                 // 住所
    phone?: string | null           // 電話番号（任意）
    website?: string | null         // ウェブサイトURL（任意）
    businessHours?: string | null   // 営業時間（任意）
    closedDays?: string | null      // 定休日（任意）
    genres: Genre[]                 // 取り扱いジャンルの配列
    averageRating: number | null    // 平均評価（1-5の数値、レビューがない場合はnull）
    reviewCount: number             // レビュー件数
  }
}

/**
 * 地図ピンアイコンコンポーネント
 * 住所の横に表示する位置マーカーのSVGアイコン
 *
 * @param className - 追加のCSSクラス名
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
 * 電話アイコンコンポーネント
 * 電話番号の横に表示する受話器のSVGアイコン
 *
 * @param className - 追加のCSSクラス名
 */
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

/**
 * 時計アイコンコンポーネント
 * 営業時間の横に表示する時計のSVGアイコン
 *
 * @param className - 追加のCSSクラス名
 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

/**
 * ShopCardコンポーネント
 * 盆栽園の情報をカード形式で表示する
 *
 * @param shop - 表示する盆栽園の情報
 * @returns カード形式の盆栽園情報JSX
 */
export function ShopCard({ shop }: ShopCardProps) {
  return (
    // カード全体をリンクとして設定し、クリックで詳細ページへ遷移
    <Link
      href={`/shops/${shop.id}`}
      className="block bg-card rounded-lg border p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex flex-col gap-2">
        {/* 盆栽園の名前と評価を表示するエリア */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg">{shop.name}</h3>
          {/* 評価がある場合のみ星評価を表示 */}
          {shop.averageRating !== null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <StarRatingDisplay rating={shop.averageRating} size="sm" />
              <span className="text-xs text-muted-foreground">
                ({shop.reviewCount})
              </span>
            </div>
          )}
        </div>

        {/* 住所を表示 */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPinIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{shop.address}</span>
        </div>

        {/* 電話番号がある場合のみ表示 */}
        {shop.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PhoneIcon className="w-4 h-4 flex-shrink-0" />
            <span>{shop.phone}</span>
          </div>
        )}

        {/* 営業時間がある場合のみ表示 */}
        {shop.businessHours && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClockIcon className="w-4 h-4 flex-shrink-0" />
            <span>{shop.businessHours}</span>
          </div>
        )}

        {/* ジャンルタグを表示 */}
        {shop.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {shop.genres.map((genre) => (
              <span
                key={genre.id}
                className="text-xs px-2 py-0.5 bg-muted rounded-full"
              >
                {genre.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
