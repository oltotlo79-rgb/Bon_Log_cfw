import { vi } from 'vitest'
/**
 * BonsaiRecordForm コンポーネントの拡張テスト
 */
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Server Actionsモック
const mockAddBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  addBonsaiRecord: (...args: unknown[]) => mockAddBonsaiRecord(...args),
}))

// 画像圧縮モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn().mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' })),
  formatFileSize: vi.fn((size) => `${Math.round(size / 1024)}KB`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'

describe('BonsaiRecordForm 拡張テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('フォームが正しくレンダリングされる', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    expect(screen.getByPlaceholderText(/成長の様子や作業内容を記録/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /記録する/i })).toBeInTheDocument()
  })

  it('テキスト入力ができる', async () => {
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/i)
    await user.type(textarea, '今日は剪定をしました')

    expect(textarea).toHaveValue('今日は剪定をしました')
  })

  it('記録作成が成功するとフォームがリセットされる', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/i)
    await user.type(textarea, '今日は水やりをしました')

    await user.click(screen.getByRole('button', { name: /記録する/i }))

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('記録作成が失敗してもクラッシュしない', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ error: '作成に失敗しました' })

    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/i)
    await user.type(textarea, 'テスト記録')

    await user.click(screen.getByRole('button', { name: /記録する/i }))

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalled()
    })

    // エラーが表示される
    await waitFor(() => {
      expect(screen.getByText('作成に失敗しました')).toBeInTheDocument()
    })
  })

  it('送信中はボタンのテキストが変わる', async () => {
    mockAddBonsaiRecord.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    )

    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/i)
    await user.type(textarea, 'テスト記録')

    await user.click(screen.getByRole('button', { name: /記録する/i }))

    // ボタンテキストが「保存中...」に変わる
    expect(screen.getByRole('button', { name: /保存中/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /記録する/i })).toBeInTheDocument()
    })
  })

  it('画像追加ラベルが表示される', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    expect(screen.getByText('画像を追加')).toBeInTheDocument()
    expect(screen.getByText('最大4枚まで')).toBeInTheDocument()
  })

  it('空のテキストでは送信ボタンが無効化される', () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const submitButton = screen.getByRole('button', { name: /記録する/i })
    expect(submitButton).toBeDisabled()
  })

  it('テキストを入力すると送信ボタンが有効になる', async () => {
    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/i)
    await user.type(textarea, 'テスト')

    const submitButton = screen.getByRole('button', { name: /記録する/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('bonsaiIdがpropsとして正しく渡される', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BonsaiRecordForm bonsaiId="specific-bonsai-123" />)

    const textarea = screen.getByPlaceholderText(/成長の様子や作業内容を記録/i)
    await user.type(textarea, 'テスト')

    await user.click(screen.getByRole('button', { name: /記録する/i }))

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          bonsaiId: 'specific-bonsai-123',
        })
      )
    })
  })
})
