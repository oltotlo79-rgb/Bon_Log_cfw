/**
 * NinjaAdMax広告コンポーネントのテスト
 */

import { render, screen } from '../../utils/test-utils'
import { NinjaAd, NinjaInFeedAd, NinjaSidebarAd } from '@/components/ads/NinjaAdMax'

describe('NinjaAd', () => {
  it('adIdがない場合はプレースホルダーを表示する', () => {
    render(<NinjaAd />)
    expect(screen.getByText('広告スペース')).toBeInTheDocument()
  })

  it('adIdがundefinedの場合はプレースホルダーを表示する', () => {
    render(<NinjaAd adId={undefined} />)
    expect(screen.getByText('広告スペース')).toBeInTheDocument()
  })

  it('プレースホルダーにデフォルトサイズが適用される', () => {
    const { container } = render(<NinjaAd />)
    const div = container.firstChild as HTMLElement
    expect(div.style.width).toBe('300px')
    expect(div.style.minHeight).toBe('250px')
  })

  it('プレースホルダーにカスタムサイズが適用される', () => {
    const { container } = render(<NinjaAd width={728} height={90} />)
    const div = container.firstChild as HTMLElement
    expect(div.style.width).toBe('728px')
    expect(div.style.minHeight).toBe('90px')
  })

  it('プレースホルダーにclassNameが適用される', () => {
    const { container } = render(<NinjaAd className="my-class" />)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('my-class')
  })

  it('adIdがある場合はiframeを表示する', () => {
    render(<NinjaAd adId="test-ad-123" />)
    const iframe = screen.getByTitle('広告')
    expect(iframe).toBeInTheDocument()
    expect(iframe.tagName).toBe('IFRAME')
  })

  it('iframeのsrcが正しい', () => {
    render(<NinjaAd adId="test-ad-123" />)
    const iframe = screen.getByTitle('広告') as HTMLIFrameElement
    expect(iframe.src).toContain('/api/ad-frame?id=test-ad-123')
  })

  it('iframeにデフォルトサイズが適用される', () => {
    render(<NinjaAd adId="test-ad-123" />)
    const iframe = screen.getByTitle('広告') as HTMLIFrameElement
    expect(iframe.style.width).toBe('300px')
    expect(iframe.style.height).toBe('250px')
  })

  it('iframeにカスタムサイズが適用される', () => {
    render(<NinjaAd adId="test-ad-123" width={728} height={90} />)
    const iframe = screen.getByTitle('広告') as HTMLIFrameElement
    expect(iframe.style.width).toBe('728px')
    expect(iframe.style.height).toBe('90px')
  })

  it('iframeにclassNameが適用される', () => {
    render(<NinjaAd adId="test-ad-123" className="custom-ad" />)
    const iframe = screen.getByTitle('広告') as HTMLIFrameElement
    expect(iframe.className).toContain('custom-ad')
  })

  it('iframeにoverflow:hiddenが設定される', () => {
    render(<NinjaAd adId="test-ad-123" />)
    const iframe = screen.getByTitle('広告') as HTMLIFrameElement
    expect(iframe.style.overflow).toBe('hidden')
  })

  it('iframeにmaxWidth:100%が設定される', () => {
    render(<NinjaAd adId="test-ad-123" />)
    const iframe = screen.getByTitle('広告') as HTMLIFrameElement
    expect(iframe.style.maxWidth).toBe('100%')
  })

  it('プレースホルダーにmaxWidth:100%が設定される', () => {
    const { container } = render(<NinjaAd />)
    const div = container.firstChild as HTMLElement
    expect(div.style.maxWidth).toBe('100%')
  })
})

describe('NinjaInFeedAd', () => {
  it('NinjaAdをラップして表示する', () => {
    render(<NinjaInFeedAd adId="feed-ad-1" />)
    expect(screen.getByTitle('広告')).toBeInTheDocument()
  })

  it('adIdなしでプレースホルダーを表示する', () => {
    render(<NinjaInFeedAd />)
    expect(screen.getByText('広告スペース')).toBeInTheDocument()
  })

  it('classNameが適用される', () => {
    const { container } = render(<NinjaInFeedAd className="feed-class" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('feed-class')
  })

  it('py-4クラスが含まれる', () => {
    const { container } = render(<NinjaInFeedAd />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('py-4')
  })
})

describe('NinjaSidebarAd', () => {
  it('NinjaAdをラップして表示する', () => {
    render(<NinjaSidebarAd adId="sidebar-ad-1" />)
    expect(screen.getByTitle('広告')).toBeInTheDocument()
  })

  it('adIdなしでプレースホルダーを表示する', () => {
    render(<NinjaSidebarAd />)
    expect(screen.getByText('広告スペース')).toBeInTheDocument()
  })

  it('classNameが適用される', () => {
    const { container } = render(<NinjaSidebarAd className="sidebar-class" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('sidebar-class')
  })
})
