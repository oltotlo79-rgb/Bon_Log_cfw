import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BonsaiCareType } from '@prisma/client'

const mockDeleteBonsaiCareLog = vi.fn()

vi.mock('@/lib/actions/bonsai-care-log', () => ({
  deleteBonsaiCareLog: (...args: unknown[]) => mockDeleteBonsaiCareLog(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import { BonsaiCareLogSheet } from '@/components/bonsai/calendar/BonsaiCareLogSheet'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'

const makeLog = (id: string, hour: number, type: BonsaiCareType = BonsaiCareType.pesticide): CareLogListItem => ({
  id,
  type,
  performedAt: new Date(2026, 3, 15, hour, 0),
  note: null,
})

describe('BonsaiCareLogSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('open=false なら描画しない', () => {
    render(
      <BonsaiCareLogSheet
        open={false}
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[]}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ログ 0 件の表示', () => {
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[]}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    expect(screen.getByText('記録はまだありません')).toBeInTheDocument()
  })

  it('ログ複数件: 各種ボタンと内容', () => {
    const logs = [makeLog('a', 9), makeLog('b', 14, BonsaiCareType.shading)]
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={logs}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    // 種別ラベル
    expect(screen.getByText('消毒')).toBeInTheDocument()
    expect(screen.getByText('遮光')).toBeInTheDocument()
    // 編集・削除ボタンが各 1 件あたり 1 個ずつ
    expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(2)
  })

  it('編集ボタンで onEdit が log を渡して呼ばれる', () => {
    const onEdit = vi.fn()
    const log = makeLog('a', 9)
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[log]}
        records={[]}
        posts={[]}
        onEdit={onEdit}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    expect(onEdit).toHaveBeenCalledWith(log)
  })

  it('追加ボタンで onAdd', () => {
    const onAdd = vi.fn()
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[]}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={onAdd}
        onChanged={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '手入れ記録を追加' }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('成長記録 / タグ付け投稿が描画され、リンクが盆栽詳細・投稿詳細に向く', () => {
    const records: BonsaiRecordCalendarItem[] = [
      {
        id: 'r1',
        bonsaiId: 'bonsai-1',
        bonsaiName: '黒松',
        content: '葉を整理',
        recordAt: new Date(2026, 3, 15, 9, 0),
        imageCount: 2,
      },
    ]
    const posts: BonsaiPostCalendarItem[] = [
      {
        id: 'post-1',
        bonsaiId: 'bonsai-1',
        bonsaiName: '黒松',
        content: '日光浴中',
        createdAt: new Date(2026, 3, 15, 14, 0),
        mediaCount: 1,
      },
    ]
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[]}
        records={records}
        posts={posts}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    // 各セクションの見出し
    expect(screen.getByText('成長記録')).toBeInTheDocument()
    expect(screen.getByText('タグ付け投稿')).toBeInTheDocument()
    // 盆栽名・本文（重複名のため getAllByText で取得）
    expect(screen.getAllByText('黒松')).toHaveLength(2)
    expect(screen.getByText('葉を整理')).toBeInTheDocument()
    expect(screen.getByText('日光浴中')).toBeInTheDocument()
    // リンク先
    const recordLink = screen.getByRole('link', { name: /黒松[\s\S]*葉を整理/ })
    expect(recordLink).toHaveAttribute('href', '/bonsai/bonsai-1')
    const postLink = screen.getByRole('link', { name: /黒松[\s\S]*日光浴中/ })
    expect(postLink).toHaveAttribute('href', '/posts/post-1')
  })

  it('overlay の本文は最大長を超えると省略記号付きになる', () => {
    const long = 'あ'.repeat(120)
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[]}
        records={[
          {
            id: 'r1',
            bonsaiId: 'b1',
            bonsaiName: '黒松',
            content: long,
            recordAt: new Date(2026, 3, 15, 9, 0),
            imageCount: 0,
          },
        ]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    const truncated = `${'あ'.repeat(80)}…`
    expect(screen.getByText(truncated)).toBeInTheDocument()
  })

  it('削除ボタン → 確認ダイアログ → 確定で deleteBonsaiCareLog 呼び出し', async () => {
    mockDeleteBonsaiCareLog.mockResolvedValue({ success: true })
    const onChanged = vi.fn()
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[makeLog('log-1', 9)]}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={onChanged}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    // AlertDialog の Action ボタン
    fireEvent.click(await screen.findByRole('button', { name: '削除' }))
    await waitFor(() => {
      expect(mockDeleteBonsaiCareLog).toHaveBeenCalledWith('log-1')
    })
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled()
    })
  })

  it('成長記録リンクをクリックすると onOpenChange(false) が呼ばれる（Dialog を閉じてから遷移）', () => {
    const onOpenChange = vi.fn()
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={onOpenChange}
        date={new Date(2026, 3, 15)}
        logs={[]}
        records={[
          { id: 'r1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, recordAt: new Date(2026, 3, 15, 9, 0), imageCount: 0 },
        ]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('link', { name: /黒松/ }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('タグ付け投稿リンクをクリックすると onOpenChange(false) が呼ばれる', () => {
    const onOpenChange = vi.fn()
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={onOpenChange}
        date={new Date(2026, 3, 15)}
        logs={[]}
        records={[]}
        posts={[
          { id: 'p1', bonsaiId: 'b1', bonsaiName: '黒松', content: null, createdAt: new Date(2026, 3, 15, 14, 0), mediaCount: 0 },
        ]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('link', { name: /黒松/ }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('date が null の場合、タイトルは空文字になる', () => {
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={null}
        logs={[]}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    // DialogTitle 要素自体は存在するが中身が空文字
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('この日の記録（0件）')
  })

  it('ログにコメント (note) がある場合、本文が表示される', () => {
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[{ id: 'log-note', type: BonsaiCareType.pesticide, performedAt: new Date(2026, 3, 15, 9, 0), note: 'ベンレート散布' }]}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    expect(screen.getByText('ベンレート散布')).toBeInTheDocument()
  })

  it('削除失敗時は toast を表示', async () => {
    mockDeleteBonsaiCareLog.mockResolvedValue({ success: false, error: 'failed' })
    render(
      <BonsaiCareLogSheet
        open
        onOpenChange={() => {}}
        date={new Date(2026, 3, 15)}
        logs={[makeLog('log-1', 9)]}
        records={[]}
        posts={[]}
        onEdit={() => {}}
        onAdd={() => {}}
        onChanged={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    fireEvent.click(await screen.findByRole('button', { name: '削除' }))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '削除に失敗しました',
          variant: 'destructive',
        }),
      )
    })
  })
})
