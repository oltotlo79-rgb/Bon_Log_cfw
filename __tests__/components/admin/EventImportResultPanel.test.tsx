import { render, screen } from '../../utils/test-utils'
import { EventImportResultPanel } from '@/app/admin/events/import/EventImportResultPanel'
import type { EventImportItemIssue } from '@/lib/validation/event-import'

describe('EventImportResultPanel', () => {
  it('取込件数を表示する', () => {
    render(<EventImportResultPanel importedCount={3} clippedItems={[]} rejectedItems={[]} />)
    expect(screen.getByText('3件のイベントをインポートしました')).toBeInTheDocument()
  })

  it('取込件数0件でも成功メッセージ自体は表示する', () => {
    render(<EventImportResultPanel importedCount={0} clippedItems={[]} rejectedItems={[]} />)
    expect(screen.getByText('0件のイベントをインポートしました')).toBeInTheDocument()
  })

  it('clippedItems が無い場合は切り詰めパネルを表示しない', () => {
    render(<EventImportResultPanel importedCount={1} clippedItems={[]} rejectedItems={[]} />)
    expect(screen.queryByText(/一部フィールドを切り詰めて取込みました/)).not.toBeInTheDocument()
  })

  it('clippedItems がある場合は件数とタイトル・違反内容を表示する', () => {
    const clippedItems: EventImportItemIssue[] = [
      {
        index: 0,
        title: '主催者が長いイベント',
        violations: [{ field: 'organizer', kind: 'clipped', actualLength: 249, maxLength: 200 }],
      },
    ]
    render(<EventImportResultPanel importedCount={2} clippedItems={clippedItems} rejectedItems={[]} />)

    expect(screen.getByText('1件は一部フィールドを切り詰めて取込みました')).toBeInTheDocument()
    expect(screen.getByText('主催者が長いイベント')).toBeInTheDocument()
    expect(screen.getByText(/主催者 249\/200文字/)).toBeInTheDocument()
  })

  it('rejectedItems が無い場合は取込不可パネルを表示しない', () => {
    render(<EventImportResultPanel importedCount={1} clippedItems={[]} rejectedItems={[]} />)
    expect(screen.queryByText(/取込できませんでした/)).not.toBeInTheDocument()
  })

  it('rejectedItems がある場合は件数とタイトル・違反内容・再編集の案内を表示する', () => {
    const rejectedItems: EventImportItemIssue[] = [
      {
        index: 0,
        title: '不良イベント',
        violations: [{ field: 'organizer', kind: 'rejected', actualLength: 2500, maxLength: 2000 }],
      },
    ]
    render(<EventImportResultPanel importedCount={0} clippedItems={[]} rejectedItems={rejectedItems} />)

    expect(screen.getByText('1件は取込できませんでした')).toBeInTheDocument()
    expect(screen.getByText('不良イベント')).toBeInTheDocument()
    expect(screen.getByText(/主催者 2500\/2000文字/)).toBeInTheDocument()
    expect(screen.getByText(/編集して再度お試しください/)).toBeInTheDocument()
  })

  it('clippedItems と rejectedItems が同時に存在する場合は両方のパネルを表示する', () => {
    const clippedItems: EventImportItemIssue[] = [
      { index: 0, title: 'クリップイベント', violations: [{ field: 'venue', kind: 'clipped', actualLength: 210, maxLength: 200 }] },
    ]
    const rejectedItems: EventImportItemIssue[] = [
      { index: 1, title: '不良イベント', violations: [{ field: 'organizer', kind: 'rejected', actualLength: 2500, maxLength: 2000 }] },
    ]
    render(<EventImportResultPanel importedCount={1} clippedItems={clippedItems} rejectedItems={rejectedItems} />)

    expect(screen.getByText('1件は一部フィールドを切り詰めて取込みました')).toBeInTheDocument()
    expect(screen.getByText('1件は取込できませんでした')).toBeInTheDocument()
    expect(screen.getByText('クリップイベント')).toBeInTheDocument()
    expect(screen.getByText('不良イベント')).toBeInTheDocument()
  })

  it('複数の violations を「、」区切りで表示する', () => {
    const rejectedItems: EventImportItemIssue[] = [
      {
        index: 0,
        title: '複数違反イベント',
        violations: [
          { field: 'organizer', kind: 'rejected', actualLength: 2500, maxLength: 2000 },
          { field: 'venue', kind: 'rejected', actualLength: 2200, maxLength: 2000 },
        ],
      },
    ]
    render(<EventImportResultPanel importedCount={0} clippedItems={[]} rejectedItems={rejectedItems} />)

    expect(screen.getByText(/主催者 2500\/2000文字、会場 2200\/2000文字/)).toBeInTheDocument()
  })
})
