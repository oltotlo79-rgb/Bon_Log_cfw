import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '../../utils/test-utils'
import { AnimatedInkImage } from '@/components/landing/AnimatedInkImage'
import type { LandingFrameSet } from '@/lib/constants/landing-animation'

/**
 * next/image を薄い <img> に差し替える。
 * fill/priority は DOM 属性に反映されない実装のため、data-* 属性経由で検証できるようにする。
 */
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    fill,
    priority,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...rest} data-fill={fill ? 'true' : undefined} data-priority={priority ? 'true' : undefined} />
  ),
}))

const MOBILE_MEDIA_QUERY = '(max-width: 767px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

let capturedIOCallback: IntersectionObserverCallback | null = null
const observeMock = vi.fn()
const disconnectMock = vi.fn()

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    capturedIOCallback = callback
  }
  observe = observeMock
  unobserve = vi.fn()
  disconnect = disconnectMock
}

function setMatchMedia(overrides: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: overrides[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function triggerIntersecting() {
  act(() => {
    capturedIOCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
}

const frames: LandingFrameSet = {
  lightDesktop: ['/light-desktop-1.webp', '/light-desktop-2.webp', '/light-desktop-3.webp'],
  darkDesktop: ['/dark-desktop-1.webp', '/dark-desktop-2.webp'],
  lightMobile: ['/light-mobile-1.webp', '/light-mobile-2.webp'],
  darkMobile: ['/dark-mobile-1.webp'],
}

/** chained setTimeout をフェイクタイマーで確定的に進める。 */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('AnimatedInkImage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    capturedIOCallback = null
    observeMock.mockClear()
    disconnectMock.mockClear()
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
    setMatchMedia({})
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.classList.remove('dark')
  })

  it('デフォルト（非ダーク・非モバイル）では lightDesktop フレームを使用し、最初のフレームのみ表示する', () => {
    const { container } = render(<AnimatedInkImage frames={frames} alt="盆栽の生育過程" />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(frames.lightDesktop.length)
    expect(images[0]).toHaveAttribute('src', frames.lightDesktop[0])
    expect(images[0]).toHaveStyle({ opacity: '1' })
    expect(images[1]).toHaveStyle({ opacity: '0' })
    expect(images[2]).toHaveStyle({ opacity: '0' })
  })

  it('最終フレームにのみ意味のある alt テキストが設定され、それ以外は空文字', () => {
    const { container } = render(<AnimatedInkImage frames={frames} alt="盆栽の生育過程" />)
    const images = container.querySelectorAll('img')
    const last = images[images.length - 1]!
    expect(last).toHaveAttribute('alt', '盆栽の生育過程')
    expect(images[0]).toHaveAttribute('alt', '')
  })

  it('lazyStart=true（デフォルト）の場合 IntersectionObserver で監視を開始する', () => {
    render(<AnimatedInkImage frames={frames} alt="test" />)
    expect(observeMock).toHaveBeenCalledTimes(1)
  })

  it('lazyStart=true でビューに入るまではタイマーが開始されない', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="test" frameDurationMs={10} />
    )
    advance(60)
    const images = container.querySelectorAll('img')
    expect(images[0]).toHaveStyle({ opacity: '1' })
    expect(images[1]).toHaveStyle({ opacity: '0' })
  })

  it('IntersectionObserver でビューに入ったらタイマーが開始され、フレームが進行する', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="test" frameDurationMs={10} />
    )
    triggerIntersecting()
    expect(disconnectMock).toHaveBeenCalled()

    advance(60)
    const images = container.querySelectorAll('img')
    // 累積 opacity: 一度表示されたフレームは fade-out しない
    expect(images[1]).toHaveStyle({ opacity: '1' })
  })

  it('lazyStart=false の場合 IntersectionObserver を使わず即座にタイマーが開始される', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="test" frameDurationMs={10} lazyStart={false} />
    )
    expect(observeMock).not.toHaveBeenCalled()

    advance(60)
    const images = container.querySelectorAll('img')
    expect(images[1]).toHaveStyle({ opacity: '1' })
  })

  it('loop=false の場合、最終フレームに到達したら停止する', () => {
    const shortFrames: LandingFrameSet = { lightDesktop: ['/f1.webp', '/f2.webp'] }
    const { container } = render(
      <AnimatedInkImage frames={shortFrames} alt="test" frameDurationMs={10} lazyStart={false} loop={false} />
    )
    advance(100)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveStyle({ opacity: '1' })
    expect(images[1]).toHaveStyle({ opacity: '1' })
  })

  it('loop=true の場合、最終フレーム到達後 loopPauseMs 経過すると先頭フレームに戻る', () => {
    const shortFrames: LandingFrameSet = { lightDesktop: ['/f1.webp', '/f2.webp'] }
    const { container } = render(
      <AnimatedInkImage
        frames={shortFrames}
        alt="test"
        frameDurationMs={10}
        lazyStart={false}
        loop={true}
        loopPauseMs={20}
      />
    )
    // frame 0 -> 1 (10ms), 最終フレーム到達
    advance(20)
    let images = container.querySelectorAll('img')
    expect(images[1]).toHaveStyle({ opacity: '1' })

    // loopPauseMs(20ms) 経過後、先頭に戻り再度 frame 1 まで進行
    advance(80)
    images = container.querySelectorAll('img')
    // ループ後も再び最終フレームまで到達し opacity 1 を維持している
    expect(images[1]).toHaveStyle({ opacity: '1' })
  })

  it('prefers-reduced-motion: reduce の場合、最終フレームを表示しタイマーを起動しない', () => {
    setMatchMedia({ [REDUCED_MOTION_QUERY]: true })
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="test" frameDurationMs={10} lazyStart={false} />
    )
    advance(60)
    const images = container.querySelectorAll('img')
    // 最終フレームのみ表示される (displayedIndex = activeFrames.length - 1)
    expect(images[images.length - 1]).toHaveStyle({ opacity: '1' })
    expect(images[0]).toHaveStyle({ opacity: '1' })
  })

  it('isMobile=true, isDark=false の場合 lightMobile フレームを使用する', () => {
    setMatchMedia({ [MOBILE_MEDIA_QUERY]: true })
    const { container } = render(<AnimatedInkImage frames={frames} alt="test" />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(frames.lightMobile!.length)
    expect(images[0]).toHaveAttribute('src', frames.lightMobile![0])
  })

  it('isDark=true, isMobile=false の場合 darkDesktop フレームを使用する', () => {
    document.documentElement.classList.add('dark')
    const { container } = render(<AnimatedInkImage frames={frames} alt="test" />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(frames.darkDesktop!.length)
    expect(images[0]).toHaveAttribute('src', frames.darkDesktop![0])
  })

  it('isDark=true, isMobile=true かつ darkMobile がある場合 darkMobile フレームを使用する', () => {
    document.documentElement.classList.add('dark')
    setMatchMedia({ [MOBILE_MEDIA_QUERY]: true })
    const { container } = render(<AnimatedInkImage frames={frames} alt="test" />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(frames.darkMobile!.length)
    expect(images[0]).toHaveAttribute('src', frames.darkMobile![0])
  })

  it('darkMobile が未指定の場合、isDark && isMobile でも darkDesktop にフォールバックする', () => {
    const framesWithoutDarkMobile: LandingFrameSet = {
      lightDesktop: frames.lightDesktop,
      darkDesktop: frames.darkDesktop,
      lightMobile: frames.lightMobile,
    }
    document.documentElement.classList.add('dark')
    setMatchMedia({ [MOBILE_MEDIA_QUERY]: true })
    const { container } = render(<AnimatedInkImage frames={framesWithoutDarkMobile} alt="test" />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(framesWithoutDarkMobile.darkDesktop!.length)
    expect(images[0]).toHaveAttribute('src', framesWithoutDarkMobile.darkDesktop![0])
  })

  it('priority=true の場合、先頭フレームのみ priority が渡される', () => {
    const { container } = render(<AnimatedInkImage frames={frames} alt="test" priority />)
    const images = container.querySelectorAll('img')
    expect(images[0]).toHaveAttribute('data-priority', 'true')
    expect(images[1]).not.toHaveAttribute('data-priority', 'true')
  })

  it('fill=false の場合、wrapper に position/width/height の inline style が設定される', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="test" fill={false} width={200} height={100} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ position: 'relative', width: '200px', height: '100px' })
  })

  it('imageClassName を指定すると各画像に適用される', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="test" imageClassName="custom-image-class" />
    )
    const images = container.querySelectorAll('img')
    images.forEach((img) => {
      expect(img).toHaveClass('custom-image-class')
    })
  })

  it('className を指定すると wrapper に適用される', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="test" className="wrapper-class" />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('wrapper-class')
  })
})
