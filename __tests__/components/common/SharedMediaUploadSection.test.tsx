import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
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

describe('SharedMediaUploadSection', () => {
  it('ファイル選択ボタンを表示する（ghostバリアント）', () => {
    render(<SharedMediaUploadSection {...makeProps()} />)
    // ghost variant: ImageIconのみのボタン
    const btn = screen.getByRole('button')
    expect(btn).toBeInTheDocument()
  })

  it('buttonVariant=outlineの場合はテキスト付きボタンを表示する', () => {
    render(
      <SharedMediaUploadSection
        {...makeProps({ buttonVariant: 'outline', buttonLabel: '画像を追加' })}
      />
    )
    expect(screen.getByRole('button', { name: /画像を追加/ })).toBeInTheDocument()
  })

  it('buttonLabelをカスタマイズできる', () => {
    render(
      <SharedMediaUploadSection
        {...makeProps({ buttonVariant: 'outline', buttonLabel: '写真を選択' })}
      />
    )
    expect(screen.getByRole('button', { name: /写真を選択/ })).toBeInTheDocument()
  })

  it('メディアファイルがある場合にプレビューを表示する', () => {
    const mediaFiles = [{ url: '/test.jpg', type: 'image' }]
    render(<SharedMediaUploadSection {...makeProps({ mediaFiles })} />)
    const img = document.querySelector('img[src="/test.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('動画ファイルのプレビューを表示する', () => {
    const mediaFiles = [{ url: '/test.mp4', type: 'video' }]
    render(<SharedMediaUploadSection {...makeProps({ mediaFiles })} />)
    const video = document.querySelector('video[src="/test.mp4"]')
    expect(video).toBeInTheDocument()
  })

  it('削除ボタンクリックでonRemoveが呼ばれる', async () => {
    const mockRemove = vi.fn()
    const mediaFiles = [{ url: '/test.jpg', type: 'image' }]
    const user = userEvent.setup()
    render(<SharedMediaUploadSection {...makeProps({ mediaFiles, onRemove: mockRemove })} />)
    // XIconを持つ削除ボタンをクリック
    const _removeBtn = document.querySelector('button[type="button"]:not([class*="Button"])')
    // Xアイコンを含むボタン（メディアプレビュー内）
    const buttons = document.querySelectorAll('button[type="button"]')
    // 削除ボタンは最後のボタン（ファイル選択ボタンの前）
    const deleteBtn = Array.from(buttons).find(btn =>
      btn.querySelector('svg.lucide-x')
    )
    await user.click(deleteBtn!)
    expect(mockRemove).toHaveBeenCalledWith(0)
  })

  it('複数メディアがある場合にgrid-cols-2を適用する', () => {
    const mediaFiles = [
      { url: '/img1.jpg', type: 'image' },
      { url: '/img2.jpg', type: 'image' },
    ]
    const { container } = render(<SharedMediaUploadSection {...makeProps({ mediaFiles })} />)
    expect(container.querySelector('.grid-cols-2')).toBeInTheDocument()
  })

  it('メディアが1枚の場合はgrid-cols-2を適用しない', () => {
    const mediaFiles = [{ url: '/img1.jpg', type: 'image' }]
    const { container } = render(<SharedMediaUploadSection {...makeProps({ mediaFiles })} />)
    expect(container.querySelector('.grid-cols-2')).not.toBeInTheDocument()
  })

  it('maxTotalに達した場合にファイル選択ボタンが無効化される', () => {
    const mediaFiles = [
      { url: '/img1.jpg', type: 'image' },
      { url: '/img2.jpg', type: 'image' },
    ]
    render(<SharedMediaUploadSection {...makeProps({ mediaFiles, maxTotal: 2 })} />)
    const allBtns = screen.getAllByRole('button')
    const fileSelectBtn = allBtns.find(btn =>
      btn.querySelector('svg.lucide-image')
    )
    expect(fileSelectBtn).toBeDisabled()
  })

  it('disabled=trueの場合にファイル選択ボタンが無効化される', () => {
    render(<SharedMediaUploadSection {...makeProps({ disabled: true })} />)
    const allBtns = screen.getAllByRole('button')
    const fileSelectBtn = allBtns.find(btn =>
      btn.querySelector('svg.lucide-image')
    )
    expect(fileSelectBtn).toBeDisabled()
  })

  it('uploading=trueの場合にプログレスバーを表示する', () => {
    render(<SharedMediaUploadSection {...makeProps({ uploading: true, uploadProgress: 50 })} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('uploading=falseの場合にプログレスバーを表示しない', () => {
    render(<SharedMediaUploadSection {...makeProps({ uploading: false, uploadProgress: 0 })} />)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('uploading=trueの場合にファイル選択ボタンが無効化される', () => {
    render(<SharedMediaUploadSection {...makeProps({ uploading: true })} />)
    const allBtns = screen.getAllByRole('button')
    const fileSelectBtn = allBtns.find(btn =>
      btn.querySelector('svg.lucide-image')
    )
    expect(fileSelectBtn).toBeDisabled()
  })

  it('imagesOnly=trueの場合、画像MIMEのみacceptする（動画を含まない）', () => {
    render(<SharedMediaUploadSection {...makeProps({ imagesOnly: true })} />)
    const input = document.querySelector('input[type="file"]')
    const accept = input?.getAttribute('accept') ?? ''
    // 画像MIMEが含まれることを確認
    expect(accept).toContain('image/jpeg')
    // 動画MIMEが含まれないことを確認
    expect(accept).not.toContain('video/')
  })

  it('imagesOnly=falseの場合、画像と動画をacceptする', () => {
    render(<SharedMediaUploadSection {...makeProps({ imagesOnly: false })} />)
    const input = document.querySelector('input[type="file"]')
    expect(input?.getAttribute('accept')).toContain('video/mp4')
  })

  it('multiple=falseの場合、複数選択を無効にする', () => {
    render(<SharedMediaUploadSection {...makeProps({ multiple: false })} />)
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toHaveAttribute('multiple')
  })

  it('multiple=trueの場合、複数選択を有効にする', () => {
    render(<SharedMediaUploadSection {...makeProps({ multiple: true })} />)
    const input = document.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('multiple')
  })

  it('ファイル入力のonChangeでonFileSelectが呼ばれる', () => {
    const mockFileSelect = vi.fn()
    render(<SharedMediaUploadSection {...makeProps({ onFileSelect: mockFileSelect })} />)
    const input = document.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [] } })
    expect(mockFileSelect).toHaveBeenCalledTimes(1)
  })

  it('メディアがない場合はプレビューグリッドを表示しない', () => {
    const { container } = render(<SharedMediaUploadSection {...makeProps({ mediaFiles: [] })} />)
    expect(container.querySelector('.grid')).not.toBeInTheDocument()
  })
})
