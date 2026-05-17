import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiseasePestImageLightbox } from '@/components/pesticide/DiseasePestImageLightbox'

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} data-testid="lightbox-thumb" />
  ),
}))

describe('DiseasePestImageLightbox', () => {
  it('サムネイル画像とアクセシビリティラベルを表示する', () => {
    render(
      <DiseasePestImageLightbox
        imageUrl="/test.jpg"
        alt="サビ病"
      />
    )
    const thumb = screen.getByTestId('lightbox-thumb')
    expect(thumb).toBeInTheDocument()
    expect(thumb).toHaveAttribute('src', '/test.jpg')
    expect(thumb).toHaveAttribute('alt', 'サビ病')
    const trigger = screen.getByRole('button', { name: /サビ病を大きく表示/ })
    expect(trigger).toBeInTheDocument()
  })

  it('nameを渡すとダイアログ内に名前を表示する', async () => {
    render(
      <DiseasePestImageLightbox
        imageUrl="/test.jpg"
        alt="サビ病"
        name="サビ病（写真）"
      />
    )
    const trigger = screen.getByRole('button', { name: /サビ病を大きく表示/ })
    fireEvent.click(trigger)
    expect(await screen.findByText('サビ病（写真）')).toBeInTheDocument()
  })

  it('クリックで拡大画像が表示される', async () => {
    render(
      <DiseasePestImageLightbox
        imageUrl="/test.jpg"
        alt="サビ病"
      />
    )
    const trigger = screen.getByRole('button', { name: /サビ病を大きく表示/ })
    fireEvent.click(trigger)
    const expandedImg = await screen.findByRole('img', { name: 'サビ病' })
    expect(expandedImg).toBeInTheDocument()
    expect(expandedImg).toHaveAttribute('src', '/test.jpg')
  })
})
