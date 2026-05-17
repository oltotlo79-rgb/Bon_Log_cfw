import Image from 'next/image'
import { getCurrentSeason, getSeasonInfo, getSeasonImagePath } from '@/lib/utils/season'

/**
 * 季節バナーコンポーネント
 *
 * 現在の季節に応じた水墨画バナーを表示する。
 * 下端がフェードアウトして背景に自然に溶け込む。
 */
export function SeasonalBanner() {
  const season = getCurrentSeason()
  const info = getSeasonInfo(season)

  return (
    <div className="relative w-full overflow-hidden">
      <div className="relative w-full aspect-video [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
        {/* モバイル ライト */}
        <Image
          src={getSeasonImagePath(season, 'mobile')}
          alt={`${info.label}の水墨画`}
          fill
          className="object-cover md:hidden dark:hidden"
          sizes="(max-width: 768px) 100vw, 360px"
        />
        {/* デスクトップ ライト */}
        <Image
          src={getSeasonImagePath(season, 'desktop')}
          alt={`${info.label}の水墨画`}
          fill
          className="object-cover hidden md:block dark:hidden"
          sizes="360px"
        />
        {/* モバイル ダーク */}
        <Image
          src={getSeasonImagePath(season, 'mobile-dark')}
          alt={`${info.label}の水墨画`}
          fill
          className="object-cover hidden dark:block dark:md:hidden"
          sizes="(max-width: 768px) 100vw, 360px"
        />
        {/* デスクトップ ダーク */}
        <Image
          src={getSeasonImagePath(season, 'desktop-dark')}
          alt={`${info.label}の水墨画`}
          fill
          className="object-cover hidden dark:hidden dark:md:block"
          sizes="360px"
        />
      </div>
    </div>
  )
}
