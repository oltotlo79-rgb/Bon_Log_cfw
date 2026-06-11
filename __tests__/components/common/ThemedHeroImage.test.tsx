import { vi, describe, it, expect } from 'vitest'
import { render } from '../../utils/test-utils'
import { ThemedHeroImage } from '@/components/common/ThemedHeroImage'
import { FERTILIZER_IMAGES, IMAGE_ALT, IMAGE_ASPECT, IMAGE_SIZES } from '@/lib/constants/images'

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    className,
    loading,
    fetchPriority,
    fill,
    sizes,
  }: {
    src: string
    alt: string
    className?: string
    loading?: string
    fetchPriority?: string
    fill?: boolean
    sizes?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-loading={loading ?? ''}
      data-fetch-priority={fetchPriority ?? ''}
      data-fill={fill ? 'true' : 'false'}
      data-sizes={sizes}
    />
  ),
}))

describe('ThemedHeroImage', () => {
  it('ライト版とダーク版の両方をレンダリングする', () => {
    const { container } = render(
      <ThemedHeroImage
        image={FERTILIZER_IMAGES.header}
        alt={IMAGE_ALT.fertilizerHeader}
        aspect={IMAGE_ASPECT.HEADER}
        sizes={IMAGE_SIZES.HEADER}
      />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]!.getAttribute('src')).toBe(FERTILIZER_IMAGES.header.light)
    expect(imgs[1]!.getAttribute('src')).toBe(FERTILIZER_IMAGES.header.dark)
  })

  it('ライト版は dark:hidden、ダーク版は hidden dark:block クラスを持つ', () => {
    const { container } = render(
      <ThemedHeroImage
        image={FERTILIZER_IMAGES.header}
        alt={IMAGE_ALT.fertilizerHeader}
        aspect={IMAGE_ASPECT.HEADER}
        sizes={IMAGE_SIZES.HEADER}
      />
    )
    const [lightImg, darkImg] = Array.from(container.querySelectorAll('img'))
    expect(lightImg!.className).toContain('dark:hidden')
    expect(lightImg!.className).not.toContain('hidden dark:block')
    expect(darkImg!.className).toContain('hidden dark:block')
  })

  it('コンテナに aspect クラスと追加 className を適用する', () => {
    const { container } = render(
      <ThemedHeroImage
        image={FERTILIZER_IMAGES.header}
        alt={IMAGE_ALT.fertilizerHeader}
        aspect={IMAGE_ASPECT.HEADER}
        sizes={IMAGE_SIZES.HEADER}
        className="rounded-lg my-6"
      />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain(IMAGE_ASPECT.HEADER)
    expect(wrapper.className).toContain('rounded-lg')
    expect(wrapper.className).toContain('my-6')
    expect(wrapper.className).toContain('relative')
    expect(wrapper.className).toContain('overflow-hidden')
  })

  it('preload で両画像に loading="eager" + fetchPriority="high" を伝播する', () => {
    const { container } = render(
      <ThemedHeroImage
        image={FERTILIZER_IMAGES.header}
        alt={IMAGE_ALT.fertilizerHeader}
        aspect={IMAGE_ASPECT.HEADER}
        sizes={IMAGE_SIZES.HEADER}
        preload
      />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs[0]!.getAttribute('data-loading')).toBe('eager')
    expect(imgs[0]!.getAttribute('data-fetch-priority')).toBe('high')
    expect(imgs[1]!.getAttribute('data-loading')).toBe('eager')
    expect(imgs[1]!.getAttribute('data-fetch-priority')).toBe('high')
  })

  it('preload デフォルトは false (eager / fetchPriority が付かない)', () => {
    const { container } = render(
      <ThemedHeroImage
        image={FERTILIZER_IMAGES.seasonalSpring}
        alt={IMAGE_ALT.seasonalSpring}
        aspect={IMAGE_ASPECT.SECTION}
        sizes={IMAGE_SIZES.SECTION}
      />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs[0]!.getAttribute('data-loading')).toBe('')
    expect(imgs[0]!.getAttribute('data-fetch-priority')).toBe('')
    expect(imgs[1]!.getAttribute('data-loading')).toBe('')
    expect(imgs[1]!.getAttribute('data-fetch-priority')).toBe('')
  })

  it('sizes 属性を両画像に伝播する', () => {
    const { container } = render(
      <ThemedHeroImage
        image={FERTILIZER_IMAGES.categoryOrganic}
        alt={IMAGE_ALT.categoryOrganic}
        aspect={IMAGE_ASPECT.CARD}
        sizes={IMAGE_SIZES.CARD}
      />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs[0]!.getAttribute('data-sizes')).toBe(IMAGE_SIZES.CARD)
    expect(imgs[1]!.getAttribute('data-sizes')).toBe(IMAGE_SIZES.CARD)
  })

  it('両画像の alt は同一（スクリーンリーダーで二重読み上げ抑止のためのセマンティック要件は呼び出し側責務）', () => {
    const { container } = render(
      <ThemedHeroImage
        image={FERTILIZER_IMAGES.header}
        alt={IMAGE_ALT.fertilizerHeader}
        aspect={IMAGE_ASPECT.HEADER}
        sizes={IMAGE_SIZES.HEADER}
      />
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs[0]!.getAttribute('alt')).toBe(IMAGE_ALT.fertilizerHeader)
    expect(imgs[1]!.getAttribute('alt')).toBe(IMAGE_ALT.fertilizerHeader)
  })
})
