/**
 * @file Map.tsx
 * @description 盆栽園マップコンポーネント（Leaflet + OpenStreetMap）
 *
 * 機能概要:
 * - OpenStreetMapをベースにした対話的な地図を表示
 * - 盆栽園の位置をカスタムピンアイコンでマーク
 * - マーカークリックでポップアップ（店名、住所、評価、詳細リンク）を表示
 * - 現在地ボタンで自分の位置に地図を移動
 * - クライアントサイドでのみ動作（SSR非対応）
 *
 * 使用例:
 * ```tsx
 * <Map
 *   shops={shops}
 *   center={MAP_DEFAULT_CENTER}
 *   zoom={10}
 * />
 * ```
 *
 * 技術的詳細:
 * - Leaflet: 軽量で高機能なオープンソース地図ライブラリ
 * - react-leaflet: LeafletのReactラッパー
 * - SSR不可のため、MapWrapperで動的インポート必須
 */
'use client'

// React hooks
// useEffect: コンポーネントのマウント検知（クライアントサイド判定）
// useState: マウント状態、ローディング状態を管理
import { useEffect, useState } from 'react'

// react-leafletコンポーネント
// MapContainer: 地図のコンテナ
// TileLayer: 地図タイルを表示（OpenStreetMap）
// Marker: マーカー（ピン）を表示
// Popup: マーカークリック時のポップアップ
// useMap: 地図インスタンスにアクセスするフック
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'

// Leaflet本体
// divIconでカスタムアイコンを作成
import L from 'leaflet'

// LeafletのCSSスタイル
// 必須: これがないとマーカーやコントロールが正しく表示されない
import 'leaflet/dist/leaflet.css'

// Next.jsのリンクコンポーネント
// ポップアップ内の詳細ページリンクに使用
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_GEOLOCATION_ZOOM } from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'
import {
  MSG_GEO_FETCH_DENIED_DESCRIPTION,
  MSG_GEO_FETCH_DENIED_TITLE,
  MSG_GEO_FETCH_FAILED,
  MSG_GEO_FETCH_FAILED_DESCRIPTION,
  MSG_GEO_NOT_SUPPORTED,
} from '@/lib/constants/messages'

/**
 * カスタムピンアイコン（盆栽園用）
 *
 * SVGで描画された緑色のマーカーピン。
 * 中央に盆栽をイメージしたシンプルなアイコン。
 *
 * iconSize: アイコンのサイズ [幅, 高さ]
 * iconAnchor: アイコンのアンカーポイント（ピンの先端位置）
 * popupAnchor: ポップアップの表示位置（アンカーからの相対位置）
 */
const shopPinIcon = L.divIcon({
  className: 'custom-pin-icon',
  html: `
    <svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" fill="#16a34a"/>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" fill="url(#paint0_linear)" fill-opacity="0.3"/>
      <circle cx="16" cy="14" r="7" fill="white"/>
      <path d="M16 10c-1.5 0-2.5 1-2.5 2 0 .5.2 1 .5 1.3-.8.4-1.5 1.2-1.5 2.2 0 1.4 1.3 2.5 3.5 2.5s3.5-1.1 3.5-2.5c0-1-.7-1.8-1.5-2.2.3-.3.5-.8.5-1.3 0-1-1-2-2.5-2z" fill="#16a34a"/>
      <defs>
        <linearGradient id="paint0_linear" x1="16" y1="0" x2="16" y2="44" gradientUnits="userSpaceOnUse">
          <stop stop-color="white"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  `,
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
})

/**
 * 盆栽園情報の型定義（エクスポート）
 * 地図上に表示する盆栽園のデータ構造
 */
export interface Shop {
  /** 盆栽園の一意識別子 */
  id: string
  /** 盆栽園名 */
  name: string
  /** 緯度（nullの場合は地図上に表示しない） */
  latitude: number | null
  /** 経度（nullの場合は地図上に表示しない） */
  longitude: number | null
  /** 住所 */
  address: string
  /** 平均評価（レビューがない場合はnull） */
  averageRating: number | null
  /** レビュー件数 */
  reviewCount: number
}

/**
 * Mapコンポーネントのプロパティ定義
 */
interface MapProps {
  /** 地図上に表示する盆栽園の配列 */
  shops: Shop[]
  /** 地図の中心座標 [緯度, 経度]（デフォルト: 東京駅付近） */
  center?: [number, number]
  /** 地図のズームレベル（デフォルト: 6） */
  zoom?: number
  /** マーカークリック時のコールバック（任意） */
  onShopClick?: (shopId: string) => void
}

/**
 * 現在地ボタンコンポーネント
 *
 * クリックするとブラウザの位置情報APIを使用して
 * ユーザーの現在地を取得し、地図を移動する。
 * 位置情報が取得できない場合はアラートを表示。
 */
function LocationButton() {
  // react-leafletのuseMapフックで地図インスタンスを取得
  const map = useMap()
  const { toast } = useToast()

  // 位置情報取得中の状態
  const [loading, setLoading] = useState(false)

  /**
   * 現在地ボタンクリックのハンドラ
   * Geolocation APIで現在地を取得し、地図を移動
   */
  const handleClick = () => {
    if (!('geolocation' in navigator)) {
      // Geolocation非対応ブラウザ
      toast({ title: MSG_GEO_NOT_SUPPORTED, variant: 'destructive' })
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // 成功: 取得した座標に地図を移動（ズームレベル14）
        const { latitude, longitude } = position.coords
        map.setView([latitude, longitude], MAP_GEOLOCATION_ZOOM)
        setLoading(false)
      },
      (err) => {
        // 失敗: エラー種別に応じたトーストを表示
        setLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          toast({
            variant: 'destructive',
            title: MSG_GEO_FETCH_DENIED_TITLE,
            description: MSG_GEO_FETCH_DENIED_DESCRIPTION,
          })
        } else {
          toast({
            variant: 'destructive',
            title: MSG_GEO_FETCH_FAILED,
            description: MSG_GEO_FETCH_FAILED_DESCRIPTION,
          })
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="absolute bottom-4 right-4 z-[1000] bg-card p-2 rounded-lg shadow-md hover:bg-muted/50 disabled:opacity-50"
      title="現在地に移動"
    >
      {loading ? (
        // ローディング中はスピナーを表示
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      ) : (
        // 通常時は現在地アイコンを表示
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      )}
    </button>
  )
}

/**
 * 星評価表示コンポーネント（地図ポップアップ用）
 *
 * 5つの星で評価を視覚的に表示。
 * 塗りつぶし、半分塗りつぶし、空の3種類で評価を表現。
 *
 * @param rating - 評価値（0〜5の小数）
 * @param size - サイズ（'sm' または 'md'）
 */
function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const stars = []
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      // 塗りつぶし星
      stars.push(
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`text-foreground ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    } else if (i === fullStars && hasHalfStar) {
      // 半分塗りつぶし星（グラデーション使用）
      stars.push(
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`text-foreground ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <defs>
            <linearGradient id="halfStar">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path fill="url(#halfStar)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    } else {
      // 空の星
      stars.push(
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`text-muted-foreground/30 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    }
  }

  return <div className="flex items-center gap-0.5">{stars}</div>
}

/**
 * 盆栽園マップコンポーネント
 *
 * OpenStreetMapをベースにした対話的な地図。
 * 盆栽園の位置にマーカーを表示し、クリックで詳細ポップアップを表示。
 * 現在地ボタンで自分の位置に移動可能。
 *
 * @param shops - 表示する盆栽園の配列
 * @param center - 地図の中心座標（デフォルト: 東京）
 * @param zoom - ズームレベル（デフォルト: 6）
 */
export function Map({ shops, center = MAP_DEFAULT_CENTER, zoom = MAP_DEFAULT_ZOOM }: MapProps) {
  // コンポーネントがマウントされたかどうかの状態
  // Leafletはクライアントサイドでのみ動作するため、マウント後に描画
  const [isMounted, setIsMounted] = useState(false)

  /**
   * クライアントサイドでのみ地図をレンダリング
   * Leafletはwindowオブジェクトに依存するため、サーバーサイドで動作しない
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
  }, [])

  // マウント前はローディング表示
  if (!isMounted) {
    return (
      <div className="h-full w-full bg-muted flex items-center justify-center rounded-lg">
        <div className="text-muted-foreground">地図を読み込み中...</div>
      </div>
    )
  }

  // 有効な座標（latitude/longitudeがnullでない）を持つ盆栽園のみフィルタリング
  const validShops = shops.filter(
    (shop) => shop.latitude !== null && shop.longitude !== null
  )

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden border">
      {/* Leaflet地図コンテナ */}
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        {/* OpenStreetMapタイルレイヤー */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 盆栽園マーカー */}
        {validShops.map((shop) => (
          <Marker
            key={shop.id}
            position={[shop.latitude!, shop.longitude!]}
            icon={shopPinIcon}
          >
            {/* マーカークリック時のポップアップ */}
            <Popup>
              <div className="min-w-[180px]">
                {/* 盆栽園名 */}
                <h3 className="font-bold text-sm mb-1">{shop.name}</h3>
                {/* 住所 */}
                <p className="text-xs text-muted-foreground mb-2">{shop.address}</p>
                {/* 評価（評価がある場合のみ表示） */}
                {shop.averageRating !== null && (
                  <div className="flex items-center gap-1 mb-2">
                    <StarRating rating={shop.averageRating} />
                    <span className="text-xs text-muted-foreground">
                      ({shop.reviewCount}件)
                    </span>
                  </div>
                )}
                {/* 詳細ページへのリンク */}
                <Link
                  href={`/shops/${shop.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  詳細を見る <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 現在地ボタン */}
        <LocationButton />
      </MapContainer>
    </div>
  )
}
