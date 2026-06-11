/**
 * SharedMediaUploadSection - extra branch coverage
 *
 * Targets:
 * - Video media renders <video> element instead of <Image>
 * - imagesOnly=true sets accept to 'image/*'
 * - imagesOnly=false sets accept to full media types
 * - multiple=false on file input
 * - ghost button variant (default) rendering
 * - disabled prop disables ghost button
 */

import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { createRef } from 'react'
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import type { SharedMediaUploadSectionProps } from '@/components/common/SharedMediaUploadSection'

function makeProps(overrides: Partial<SharedMediaUploadSectionProps> = {}): SharedMediaUploadSectionProps {
  return {
    mediaFiles: [],
    uploading: false,
    uploadProgress: 0,
    onFileSelect: vi.fn(),
    onRemove: vi.fn(),
    fileInputRef: createRef<HTMLInputElement | null>(),
    maxTotal: 4,
    ...overrides,
  }
}

describe('SharedMediaUploadSection - extra branches', () => {
  it('video media renders <video> element', () => {
    const mediaFiles = [{ url: '/video.mp4', type: 'video' }]
    const { container } = render(
      <SharedMediaUploadSection {...makeProps({ mediaFiles })} />
    )

    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', '/video.mp4')
  })

  it('imagesOnly=true sets accept to image/*', () => {
    const { container } = render(
      <SharedMediaUploadSection {...makeProps({ imagesOnly: true })} />
    )

    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('accept', 'image/*')
  })

  it('imagesOnly=false includes video types in accept', () => {
    const { container } = render(
      <SharedMediaUploadSection {...makeProps({ imagesOnly: false })} />
    )

    const input = container.querySelector('input[type="file"]')
    expect(input?.getAttribute('accept')).toContain('video/')
  })

  it('multiple=false on file input', () => {
    const { container } = render(
      <SharedMediaUploadSection {...makeProps({ multiple: false })} />
    )

    const input = container.querySelector('input[type="file"]')
    expect(input).not.toHaveAttribute('multiple')
  })

  it('ghost button variant renders without text', () => {
    render(
      <SharedMediaUploadSection {...makeProps({ buttonVariant: 'ghost' })} />
    )

    // Ghost variant has no text label
    const buttons = screen.getAllByRole('button')
    const ghostButton = buttons.find(b => !b.textContent?.includes('画像'))
    expect(ghostButton).toBeDefined()
  })

  it('disabled prop disables ghost button', () => {
    render(
      <SharedMediaUploadSection {...makeProps({ buttonVariant: 'ghost', disabled: true })} />
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('remove button calls onRemove with correct index', () => {
    const onRemove = vi.fn()
    const mediaFiles = [
      { url: '/img1.jpg', type: 'image' },
      { url: '/img2.jpg', type: 'image' },
    ]
    const { container } = render(
      <SharedMediaUploadSection {...makeProps({ mediaFiles, onRemove })} />
    )

    // Find remove buttons inside media preview items
    const allButtons = container.querySelectorAll('button[type="button"]')
    // Filter to only the X buttons that are inside the media preview (have XIcon)
    const removeButtons = Array.from(allButtons).filter(
      btn => btn.closest('.relative.aspect-video')
    )
    if (removeButtons.length > 1) {
      fireEvent.click(removeButtons[1]!)
      expect(onRemove).toHaveBeenCalledWith(1)
    } else {
      // Fallback: click first remove button
      fireEvent.click(removeButtons[0]!)
      expect(onRemove).toHaveBeenCalledWith(0)
    }
  })

  it('upload progress bar shows correct percentage', () => {
    render(
      <SharedMediaUploadSection {...makeProps({ uploading: true, uploadProgress: 75 })} />
    )

    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
