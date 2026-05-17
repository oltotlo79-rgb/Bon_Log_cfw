import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { OptimizedImage } from '@/components/common/OptimizedImage'

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    onLoad,
    onError,
    onClick,
    className,
    priority,
    fill,
    width,
    height,
    sizes,
    loading,
  }: {
    src: string
    alt: string
    onLoad?: () => void
    onError?: () => void
    onClick?: (e: React.MouseEvent) => void
    className?: string
    priority?: boolean
    fill?: boolean
    width?: number
    height?: number
    sizes?: string
    loading?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onLoad={onLoad}
      onError={onError}
      data-priority={priority}
      data-fill={fill}
      data-width={width}
      data-height={height}
      data-sizes={sizes}
      data-loading={loading}
    />
  ),
}))

describe('OptimizedImage', () => {
  it('画像を表示する', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/test.jpg')
    expect(img).toHaveAttribute('alt', 'テスト画像')
  })

  it('ローディング中はパルスアニメーションを表示する', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />
    )

    const pulse = container.querySelector('.animate-pulse')
    expect(pulse).toBeInTheDocument()
  })

  it('ローディング完了時にパルスアニメーションを非表示にする', () => {
    const { container } = render(
      <OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />
    )

    const img = screen.getByRole('img')
    fireEvent.load(img)

    const pulse = container.querySelector('.animate-pulse')
    expect(pulse).not.toBeInTheDocument()
  })

  it('エラー時にフォールバックを表示する', () => {
    render(<OptimizedImage src="/broken.jpg" alt="壊れた画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    fireEvent.error(img)

    // 画像がなくなりフォールバックが表示される
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    // SVGアイコンが表示される
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('objectFit coverがデフォルトで適用される', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    expect(img).toHaveClass('object-cover')
  })

  it('objectFit containを適用する', () => {
    render(
      <OptimizedImage
        src="/test.jpg"
        alt="テスト画像"
        width={300}
        height={200}
        objectFit="contain"
      />
    )

    const img = screen.getByRole('img')
    expect(img).toHaveClass('object-contain')
  })

  it('objectFit fillを適用する', () => {
    render(
      <OptimizedImage
        src="/test.jpg"
        alt="テスト画像"
        width={300}
        height={200}
        objectFit="fill"
      />
    )

    const img = screen.getByRole('img')
    expect(img).toHaveClass('object-fill')
  })

  it('objectFit noneを適用する', () => {
    render(
      <OptimizedImage
        src="/test.jpg"
        alt="テスト画像"
        width={300}
        height={200}
        objectFit="none"
      />
    )

    const img = screen.getByRole('img')
    expect(img).toHaveClass('object-none')
  })

  it('クリックイベントを処理する', () => {
    const handleClick = vi.fn()
    render(
      <OptimizedImage
        src="/test.jpg"
        alt="テスト画像"
        width={300}
        height={200}
        onClick={handleClick}
      />
    )

    const img = screen.getByRole('img')
    fireEvent.click(img)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('カスタムクラスを適用する', () => {
    render(
      <OptimizedImage
        src="/test.jpg"
        alt="テスト画像"
        width={300}
        height={200}
        className="rounded-full"
      />
    )

    const img = screen.getByRole('img')
    expect(img).toHaveClass('rounded-full')
  })

  it('fillモードで動作する', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" fill />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('data-fill', 'true')
  })

  it('priority を設定する', () => {
    render(
      <OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} priority />
    )

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('data-priority', 'true')
  })

  it('priority がない場合はlazy loadingを設定する', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('data-loading', 'lazy')
  })

  it('sizesを設定する', () => {
    render(
      <OptimizedImage
        src="/test.jpg"
        alt="テスト画像"
        width={300}
        height={200}
        sizes="(max-width: 768px) 100vw, 50vw"
      />
    )

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('data-sizes', '(max-width: 768px) 100vw, 50vw')
  })

  it('デフォルトsizesは100vw', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('data-sizes', '100vw')
  })

  it('ローディング中は画像が透明になる', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    expect(img).toHaveClass('opacity-0')
  })

  it('ローディング完了後は画像が不透明になる', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    fireEvent.load(img)

    expect(img).toHaveClass('opacity-100')
  })

  it('トランジションクラスが適用される', () => {
    render(<OptimizedImage src="/test.jpg" alt="テスト画像" width={300} height={200} />)

    const img = screen.getByRole('img')
    expect(img).toHaveClass('transition-opacity')
    expect(img).toHaveClass('duration-300')
  })

  it('エラー時にカスタムクラスが適用される', () => {
    render(
      <OptimizedImage
        src="/broken.jpg"
        alt="壊れた画像"
        width={300}
        height={200}
        className="custom-class"
      />
    )

    const img = screen.getByRole('img')
    fireEvent.error(img)

    const fallback = document.querySelector('.custom-class')
    expect(fallback).toBeInTheDocument()
  })
})
