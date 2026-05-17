import Image from 'next/image'
import type { ImageAspectClass, ImageSizesValue, ThemedImagePair } from '@/lib/constants/images'

type Props = {
  /** ライト/ダーク画像のペア（`lib/constants/images.ts` の定数を渡す） */
  image: ThemedImagePair
  /** 代替テキスト（`IMAGE_ALT` の定数を渡す） */
  alt: string
  /** コンテナのアスペクト比クラス（`IMAGE_ASPECT` の定数を渡す） */
  aspect: ImageAspectClass
  /** レスポンシブ sizes 属性（`IMAGE_SIZES` の定数を渡す） */
  sizes: ImageSizesValue
  /**
   * ATF (Above-The-Fold) の hero 画像なら true。
   * 内部では `loading="eager"` + `fetchPriority="high"` を付与する。
   * Next.js 16 の `preload` は `<link rel="preload">` を head に出すが、
   * light/dark 両方の variant に preload を付けると CSS で隠れる側まで
   * 帯域を食うため、ここでは `eager + fetchPriority` で抑える。
   */
  preload?: boolean
  /** コンテナに追加する Tailwind クラス（rounded, margin など） */
  className?: string
}

/**
 * @module components/common/ThemedHeroImage
 * ライト/ダーク画像を `dark:hidden` / `hidden dark:block` で出し分ける挿絵コンポーネント。
 * 引き延ばし防止のため container は `relative` + aspect + `overflow-hidden`、
 * 画像は `fill` + `object-cover object-center` を固定する。
 */
export function ThemedHeroImage({ image, alt, aspect, sizes, preload = false, className }: Props) {
  const containerClass = ['relative w-full overflow-hidden', aspect, className]
    .filter(Boolean)
    .join(' ')
  const loadingProps = preload
    ? ({ loading: 'eager', fetchPriority: 'high' } as const)
    : ({} as const)
  return (
    <div className={containerClass}>
      <Image
        src={image.light}
        alt={alt}
        fill
        className="object-cover object-center dark:hidden"
        sizes={sizes}
        {...loadingProps}
      />
      <Image
        src={image.dark}
        alt={alt}
        fill
        className="object-cover object-center hidden dark:block"
        sizes={sizes}
        {...loadingProps}
      />
    </div>
  )
}
