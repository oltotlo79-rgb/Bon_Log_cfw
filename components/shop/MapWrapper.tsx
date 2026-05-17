'use client'

/**
 * @module components/shop/MapWrapper
 * Leaflet ベースの `Map` を SSR 無効で動的読み込みする 2 種類のラッパー。
 * Why SSR 無効: Leaflet が `window` に依存するため server-side で評価できない。
 */

import dynamic from 'next/dynamic'
import type { Shop } from './Map'

const Map = dynamic(
  () => import('@/components/shop/Map').then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] md:h-[400px] w-full bg-muted flex items-center justify-center rounded-lg">
        <div className="text-muted-foreground">地図を読み込み中...</div>
      </div>
    ),
  }
)

interface MapWrapperProps {
  shops: Shop[]
  center?: [number, number]
  zoom?: number
  /** 指定時は inline style で固定、未指定なら mobile 250px / md 400px のレスポンシブ */
  height?: string
}

export function MapWrapper({ shops, center, zoom, height }: MapWrapperProps) {
  if (height) {
    return (
      <div style={{ height }} className="relative z-0">
        <Map shops={shops} center={center} zoom={zoom} />
      </div>
    )
  }

  return (
    <div className="h-[250px] md:h-[400px] relative z-0">
      <Map shops={shops} center={center} zoom={zoom} />
    </div>
  )
}

export function MapWrapperSmall({ shops, center, zoom }: Omit<MapWrapperProps, 'height'>) {
  return (
    <div className="h-[300px]">
      <Map shops={shops} center={center} zoom={zoom} />
    </div>
  )
}
