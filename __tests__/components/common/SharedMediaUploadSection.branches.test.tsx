/**
 * SharedMediaUploadSection - uncovered branch tests
 *
 * Targets:
 * - previewClassName prop overrides default grid classes
 * - buttonVariant='outline' with disabled state
 * - multiple media files with custom previewClassName
 */

import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
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

describe('SharedMediaUploadSection - uncovered branches', () => {
  it('previewClassNameが指定されると、デフォルトのgridクラスの代わりに使用される', () => {
    const mediaFiles = [
      { url: '/img1.jpg', type: 'image' },
      { url: '/img2.jpg', type: 'image' },
    ]
    const { container } = render(
      <SharedMediaUploadSection
        {...makeProps({
          mediaFiles,
          previewClassName: 'custom-grid-class flex gap-4',
        })}
      />
    )

    // Default grid-cols-2 should NOT be present
    expect(container.querySelector('.grid-cols-2')).not.toBeInTheDocument()
    // Custom class should be present
    expect(container.querySelector('.custom-grid-class')).toBeInTheDocument()
  })

  it('buttonVariant=outlineかつdisabled時にボタンが無効化される', () => {
    render(
      <SharedMediaUploadSection
        {...makeProps({
          buttonVariant: 'outline',
          buttonLabel: '画像を追加',
          disabled: true,
        })}
      />
    )

    const btn = screen.getByRole('button', { name: /画像を追加/ })
    expect(btn).toBeDisabled()
  })

  it('buttonVariant=outlineかつuploading時にボタンが無効化される', () => {
    render(
      <SharedMediaUploadSection
        {...makeProps({
          buttonVariant: 'outline',
          buttonLabel: '画像を追加',
          uploading: true,
        })}
      />
    )

    const btn = screen.getByRole('button', { name: /画像を追加/ })
    expect(btn).toBeDisabled()
  })

  it('buttonVariant=outlineかつmaxTotalに達した場合にボタンが無効化される', () => {
    const mediaFiles = [
      { url: '/img1.jpg', type: 'image' },
      { url: '/img2.jpg', type: 'image' },
    ]
    render(
      <SharedMediaUploadSection
        {...makeProps({
          mediaFiles,
          maxTotal: 2,
          buttonVariant: 'outline',
          buttonLabel: '画像を追加',
        })}
      />
    )

    const btn = screen.getByRole('button', { name: /画像を追加/ })
    expect(btn).toBeDisabled()
  })

  it('単一メディアでpreviewClassNameがnullの場合、デフォルトのgridクラスが使用される', () => {
    const mediaFiles = [{ url: '/img1.jpg', type: 'image' }]
    const { container } = render(
      <SharedMediaUploadSection {...makeProps({ mediaFiles })} />
    )

    // Single image: no grid-cols-2, but has 'grid gap-2'
    expect(container.querySelector('.grid')).toBeInTheDocument()
    expect(container.querySelector('.grid-cols-2')).not.toBeInTheDocument()
  })
})
