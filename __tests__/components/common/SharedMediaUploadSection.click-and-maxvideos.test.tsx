/**
 * SharedMediaUploadSection - ファイル選択ボタンのクリック委譲 / maxVideos 境界値
 *
 * 既存テストは表示・accept属性の分岐を検証済みだが、
 * - ボタンクリックで fileInputRef.current.click() に処理委譲すること
 * - maxVideos が明示的に渡された場合の videoAllowed 判定 (=== undefined 以外の分岐)
 * は未検証だったため補強する。
 */
import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '../../utils/test-utils'
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

describe('SharedMediaUploadSection - ボタンクリックで file input へ委譲', () => {
  it('ghost variant のボタンをクリックすると fileInputRef.current.click() が呼ばれる', async () => {
    const user = userEvent.setup()
    const props = makeProps({ buttonVariant: 'ghost' })
    render(<SharedMediaUploadSection {...props} />)

    const clickSpy = vi.fn()
    // fileInputRef は実 DOM 要素なので click をスパイして委譲を検証する
    props.fileInputRef.current!.click = clickSpy

    await user.click(screen.getByRole('button'))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('outline variant のボタンをクリックすると fileInputRef.current.click() が呼ばれる', async () => {
    const user = userEvent.setup()
    const props = makeProps({ buttonVariant: 'outline', buttonLabel: '画像を追加' })
    render(<SharedMediaUploadSection {...props} />)

    const clickSpy = vi.fn()
    props.fileInputRef.current!.click = clickSpy

    await user.click(screen.getByRole('button', { name: /画像を追加/ }))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })
})

describe('SharedMediaUploadSection - maxVideos による videoAllowed 判定', () => {
  it('maxVideos=0 の場合、imagesOnly=false でも動画 MIME を含まない', () => {
    render(<SharedMediaUploadSection {...makeProps({ imagesOnly: false, maxVideos: 0 })} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.accept).not.toContain('video')
  })

  it('maxVideos=1 の場合、動画 MIME を含む', () => {
    render(<SharedMediaUploadSection {...makeProps({ imagesOnly: false, maxVideos: 1 })} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.accept).toContain('video')
  })
})
