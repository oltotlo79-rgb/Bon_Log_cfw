import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BonsaiCareType } from '@prisma/client'

const mockAddBonsaiCareLog = vi.fn()
const mockUpdateBonsaiCareLog = vi.fn()

vi.mock('@/lib/actions/bonsai-care-log', () => ({
  addBonsaiCareLog: (...args: unknown[]) => mockAddBonsaiCareLog(...args),
  updateBonsaiCareLog: (...args: unknown[]) => mockUpdateBonsaiCareLog(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import { BonsaiCareLogForm } from '@/components/bonsai/calendar/BonsaiCareLogForm'
import { MAX_BONSAI_CARE_NOTE_LENGTH } from '@/lib/constants/limits'
import type { CareLogListItem } from '@/types/bonsai-care'

describe('BonsaiCareLogForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('閉じている時は何も描画しない', () => {
    render(
      <BonsaiCareLogForm
        open={false}
        onOpenChange={() => {}}
        editing={null}
        onSaved={() => {}}
      />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('新規モード: タイトルが「追加」', () => {
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={() => {}}
        editing={null}
        onSaved={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveTextContent('手入れ記録を追加')
  })

  it('編集モード: タイトルが「編集」、フィールドに既存値が入る', () => {
    const editing: CareLogListItem = {
      id: 'log-1',
      type: BonsaiCareType.shading,
      performedAt: new Date(2026, 3, 15, 10, 30),
      note: 'メモ内容',
    }
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={() => {}}
        editing={editing}
        onSaved={() => {}}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveTextContent('手入れ記録を編集')
    expect(screen.getByLabelText('コメント（任意）')).toHaveValue('メモ内容')
    // 種別ラジオが shading でチェックされている
    const radio = screen.getByLabelText('遮光') as HTMLInputElement
    expect(radio.checked).toBe(true)
  })

  it('全 8 種別のラジオを描画', () => {
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={() => {}}
        editing={null}
        onSaved={() => {}}
      />,
    )
    expect(screen.getByLabelText('消毒')).toBeInTheDocument()
    expect(screen.getByLabelText('置き肥')).toBeInTheDocument()
    expect(screen.getByLabelText('液肥')).toBeInTheDocument()
    expect(screen.getByLabelText('移動・回転')).toBeInTheDocument()
    expect(screen.getByLabelText('遮光')).toBeInTheDocument()
    expect(screen.getByLabelText('ムロ入れ')).toBeInTheDocument()
    expect(screen.getByLabelText('ムロ出し')).toBeInTheDocument()
    expect(screen.getByLabelText('その他')).toBeInTheDocument()
  })

  it('コメント欄の maxLength が MAX_BONSAI_CARE_NOTE_LENGTH', () => {
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={() => {}}
        editing={null}
        onSaved={() => {}}
      />,
    )
    const textarea = screen.getByLabelText('コメント（任意）') as HTMLTextAreaElement
    expect(textarea.maxLength).toBe(MAX_BONSAI_CARE_NOTE_LENGTH)
  })

  it('新規保存時: addBonsaiCareLog を呼び、成功時に onSaved・onOpenChange(false)', async () => {
    mockAddBonsaiCareLog.mockResolvedValue({ success: true, data: { id: 'log-new' } })
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={onOpenChange}
        editing={null}
        onSaved={onSaved}
      />,
    )

    await user.click(screen.getByLabelText('遮光'))
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockAddBonsaiCareLog).toHaveBeenCalledTimes(1)
    })
    expect(mockAddBonsaiCareLog.mock.calls[0]![0]!).toMatchObject({
      type: BonsaiCareType.shading,
    })
    expect(onSaved).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('編集時: updateBonsaiCareLog を呼ぶ', async () => {
    mockUpdateBonsaiCareLog.mockResolvedValue({ success: true })
    const editing: CareLogListItem = {
      id: 'log-1',
      type: BonsaiCareType.pesticide,
      performedAt: new Date(2026, 3, 15, 10, 30),
      note: '初期',
    }
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={() => {}}
        editing={editing}
        onSaved={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => {
      expect(mockUpdateBonsaiCareLog).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({ type: BonsaiCareType.pesticide }),
      )
    })
  })

  it('保存失敗時に toast 表示', async () => {
    mockAddBonsaiCareLog.mockResolvedValue({ success: false, error: 'failed' })
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={() => {}}
        editing={null}
        onSaved={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '保存に失敗しました',
          variant: 'destructive',
        }),
      )
    })
  })

  it('キャンセルボタンで onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={onOpenChange}
        editing={null}
        onSaved={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('空コメントは undefined（追加時）/ null（編集時）として送信', async () => {
    mockAddBonsaiCareLog.mockResolvedValue({ success: true, data: { id: 'log-new' } })
    render(
      <BonsaiCareLogForm
        open
        onOpenChange={() => {}}
        editing={null}
        onSaved={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockAddBonsaiCareLog.mock.calls[0]![0]!.note).toBeUndefined()
    })
  })
})
