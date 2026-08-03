import { render, screen } from '../../utils/test-utils'
import { EventViolationBadges } from '@/app/admin/events/import/EventViolationBadges'
import type { EventFieldViolation } from '@/lib/validation/event-import'

describe('EventViolationBadges', () => {
  it('違反が無い場合は何も表示しない', () => {
    const { container } = render(<EventViolationBadges violations={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('clipped 違反はフィールド名と文字数を含む注意バッジを表示する', () => {
    const violations: EventFieldViolation[] = [
      { field: 'organizer', kind: 'clipped', actualLength: 249, maxLength: 200 },
    ]
    render(<EventViolationBadges violations={violations} />)

    expect(screen.getByText(/主催者 249\/200文字/)).toBeInTheDocument()
    expect(screen.getByText(/切り詰めて取込/)).toBeInTheDocument()
  })

  it('rejected 違反は取込不可バッジを表示する', () => {
    const violations: EventFieldViolation[] = [
      { field: 'organizer', kind: 'rejected', actualLength: 2500, maxLength: 2000 },
    ]
    render(<EventViolationBadges violations={violations} />)

    expect(screen.getByText(/取込不可: 主催者が長すぎます/)).toBeInTheDocument()
  })

  it('rejected と clipped が混在する場合は両方のバッジを表示する', () => {
    const violations: EventFieldViolation[] = [
      { field: 'organizer', kind: 'rejected', actualLength: 2500, maxLength: 2000 },
      { field: 'venue', kind: 'clipped', actualLength: 210, maxLength: 200 },
    ]
    render(<EventViolationBadges violations={violations} />)

    expect(screen.getByText(/取込不可: 主催者が長すぎます/)).toBeInTheDocument()
    expect(screen.getByText(/会場 210\/200文字/)).toBeInTheDocument()
  })

  it('複数フィールドが rejected の場合は「・」区切りで列挙する', () => {
    const violations: EventFieldViolation[] = [
      { field: 'organizer', kind: 'rejected', actualLength: 2500, maxLength: 2000 },
      { field: 'venue', kind: 'rejected', actualLength: 2200, maxLength: 2000 },
    ]
    render(<EventViolationBadges violations={violations} />)

    expect(screen.getByText(/取込不可: 主催者・会場が長すぎます/)).toBeInTheDocument()
  })

  it('複数フィールドが clipped の場合はそれぞれ個別バッジで表示する', () => {
    const violations: EventFieldViolation[] = [
      { field: 'organizer', kind: 'clipped', actualLength: 210, maxLength: 200 },
      { field: 'venue', kind: 'clipped', actualLength: 220, maxLength: 200 },
    ]
    render(<EventViolationBadges violations={violations} />)

    expect(screen.getByText(/主催者 210\/200文字/)).toBeInTheDocument()
    expect(screen.getByText(/会場 220\/200文字/)).toBeInTheDocument()
  })

  it('未知のフィールド名でもフォールバック表示される', () => {
    const violations: EventFieldViolation[] = [
      { field: 'unknownField', kind: 'clipped', actualLength: 10, maxLength: 5 },
    ]
    render(<EventViolationBadges violations={violations} />)

    expect(screen.getByText(/unknownField 10\/5文字/)).toBeInTheDocument()
  })
})
