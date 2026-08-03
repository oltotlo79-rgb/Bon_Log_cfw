// @vitest-environment node

import {
  importableEventSchema,
  getEventFieldViolations,
  type ImportableEventInput,
} from '@/lib/validation/event-import'
import {
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_FIELD_LENGTH,
  MAX_EVENT_URL_LENGTH,
  MAX_EVENT_FIELD_HARD_LENGTH,
  MAX_EVENT_DESCRIPTION_HARD_LENGTH,
} from '@/lib/constants/limits'

/** スキーマが要求する必須フィールドを満たした最小のベースイベントを生成する。 */
function baseEvent(overrides: Partial<ImportableEventInput> = {}): ImportableEventInput {
  return {
    id: 'temp-1',
    title: 'テストイベント',
    startDate: '2025-05-01T00:00:00.000Z',
    endDate: null,
    prefecture: null,
    city: null,
    venue: null,
    organizer: null,
    admissionFee: null,
    hasSales: false,
    description: '',
    externalUrl: null,
    sourceRegion: '関東',
    sourceUrl: 'https://example.com',
    isDuplicate: false,
    duplicateType: null,
    ...overrides,
  }
}

describe('importableEventSchema', () => {
  it('通常のイベントは検証を通過する', () => {
    const parsed = importableEventSchema.safeParse(baseEvent())
    expect(parsed.success).toBe(true)
  })

  it('organizer が249文字（回帰の核心ケース）: ソフト上限超過をクリップして受理する', () => {
    const organizer = 'あ'.repeat(249)
    const parsed = importableEventSchema.safeParse(baseEvent({ organizer }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.organizer).toHaveLength(MAX_EVENT_FIELD_LENGTH)
      expect(parsed.data.organizer).toBe('あ'.repeat(MAX_EVENT_FIELD_LENGTH))
    }
  })

  it('organizer がハード上限（2000文字）超過なら reject する', () => {
    const organizer = 'あ'.repeat(MAX_EVENT_FIELD_HARD_LENGTH + 500)
    const parsed = importableEventSchema.safeParse(baseEvent({ organizer }))

    expect(parsed.success).toBe(false)
  })

  it('organizer がハード上限ちょうど（2000文字）ならクリップして受理する（境界値）', () => {
    const organizer = 'あ'.repeat(MAX_EVENT_FIELD_HARD_LENGTH)
    const parsed = importableEventSchema.safeParse(baseEvent({ organizer }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.organizer).toHaveLength(MAX_EVENT_FIELD_LENGTH)
    }
  })

  it('organizer がハード上限+1（2001文字）なら reject する（境界値）', () => {
    const organizer = 'あ'.repeat(MAX_EVENT_FIELD_HARD_LENGTH + 1)
    const parsed = importableEventSchema.safeParse(baseEvent({ organizer }))

    expect(parsed.success).toBe(false)
  })

  it('externalUrl が2001文字なら reject する（クリップされないこと）', () => {
    const externalUrl = 'https://example.com/' + 'a'.repeat(MAX_EVENT_URL_LENGTH)
    const parsed = importableEventSchema.safeParse(baseEvent({ externalUrl }))

    expect(parsed.success).toBe(false)
  })

  it('externalUrl がちょうどMAX_EVENT_URL_LENGTHなら受理する（境界値）', () => {
    const externalUrl = 'a'.repeat(MAX_EVENT_URL_LENGTH)
    const parsed = importableEventSchema.safeParse(baseEvent({ externalUrl }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      // URLフィールドはクリップされず、そのままの長さを保持する
      expect(parsed.data.externalUrl).toHaveLength(MAX_EVENT_URL_LENGTH)
    }
  })

  it('sourceUrl が MAX_EVENT_URL_LENGTH+1 なら reject する', () => {
    const sourceUrl = 'a'.repeat(MAX_EVENT_URL_LENGTH + 1)
    const parsed = importableEventSchema.safeParse(baseEvent({ sourceUrl }))

    expect(parsed.success).toBe(false)
  })

  it('title が101文字（ソフト上限超過、ハード上限内）ならクリップして受理する', () => {
    const title = 'あ'.repeat(MAX_EVENT_TITLE_LENGTH + 1)
    const parsed = importableEventSchema.safeParse(baseEvent({ title }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.title).toHaveLength(MAX_EVENT_TITLE_LENGTH)
    }
  })

  it('title が空文字なら reject する（min(1)制約）', () => {
    const parsed = importableEventSchema.safeParse(baseEvent({ title: '' }))
    expect(parsed.success).toBe(false)
  })

  it('description がソフト上限超過ならクリップして受理する', () => {
    const description = 'あ'.repeat(MAX_EVENT_DESCRIPTION_LENGTH + 1)
    const parsed = importableEventSchema.safeParse(baseEvent({ description }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.description).toHaveLength(MAX_EVENT_DESCRIPTION_LENGTH)
    }
  })

  it('description がハード上限（10000文字）超過なら reject する', () => {
    const description = 'あ'.repeat(MAX_EVENT_DESCRIPTION_HARD_LENGTH + 1)
    const parsed = importableEventSchema.safeParse(baseEvent({ description }))

    expect(parsed.success).toBe(false)
  })

  it('description がハード上限ちょうどならクリップして受理する（境界値）', () => {
    const description = 'あ'.repeat(MAX_EVENT_DESCRIPTION_HARD_LENGTH)
    const parsed = importableEventSchema.safeParse(baseEvent({ description }))

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.description).toHaveLength(MAX_EVENT_DESCRIPTION_LENGTH)
    }
  })

  it('hasSales が文字列など型不一致なら reject する', () => {
    const parsed = importableEventSchema.safeParse(baseEvent({ hasSales: 'yes' as unknown as boolean }))
    expect(parsed.success).toBe(false)
  })

  it('venue/city/prefecture/admissionFee は null を許容する', () => {
    const parsed = importableEventSchema.safeParse(
      baseEvent({ venue: null, city: null, prefecture: null, admissionFee: null })
    )
    expect(parsed.success).toBe(true)
  })
})

describe('getEventFieldViolations', () => {
  it('違反がない場合は空配列を返す', () => {
    expect(getEventFieldViolations(baseEvent())).toEqual([])
  })

  it('organizer が249文字（回帰の核心ケース）: clipped 違反を1件返す', () => {
    const organizer = 'あ'.repeat(249)
    const violations = getEventFieldViolations(baseEvent({ organizer }))

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      field: 'organizer',
      kind: 'clipped',
      actualLength: 249,
      maxLength: MAX_EVENT_FIELD_LENGTH,
    })
  })

  it('organizer が2500文字（ハード超）: rejected 違反を返す', () => {
    const organizer = 'あ'.repeat(2500)
    const violations = getEventFieldViolations(baseEvent({ organizer }))

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      field: 'organizer',
      kind: 'rejected',
      actualLength: 2500,
      maxLength: MAX_EVENT_FIELD_HARD_LENGTH,
    })
  })

  it('externalUrl が2001文字: rejected 違反を返す（クリップされないこと）', () => {
    const externalUrl = 'a'.repeat(MAX_EVENT_URL_LENGTH + 1)
    const violations = getEventFieldViolations(baseEvent({ externalUrl }))

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      field: 'externalUrl',
      kind: 'rejected',
      actualLength: MAX_EVENT_URL_LENGTH + 1,
      maxLength: MAX_EVENT_URL_LENGTH,
    })
  })

  it('複数フィールドが違反している場合は複数件返す', () => {
    const event = baseEvent({
      organizer: 'あ'.repeat(249),
      venue: 'い'.repeat(250),
      sourceUrl: 'a'.repeat(MAX_EVENT_URL_LENGTH + 1),
    })
    const violations = getEventFieldViolations(event)

    const fields = violations.map((v) => v.field).sort()
    expect(fields).toEqual(['organizer', 'sourceUrl', 'venue'].sort())
  })

  describe('境界値: schema の safeParse 判定と一致すること', () => {
    it('汎用フィールド 200文字（ソフト上限ちょうど）は違反なし・safeParse成功', () => {
      const organizer = 'あ'.repeat(MAX_EVENT_FIELD_LENGTH)
      const event = baseEvent({ organizer })

      expect(getEventFieldViolations(event)).toEqual([])
      expect(importableEventSchema.safeParse(event).success).toBe(true)
    })

    it('汎用フィールド 201文字（ソフト上限+1）は clipped・safeParse成功（クリップ後は受理）', () => {
      const organizer = 'あ'.repeat(MAX_EVENT_FIELD_LENGTH + 1)
      const event = baseEvent({ organizer })

      const violations = getEventFieldViolations(event)
      expect(violations).toHaveLength(1)
      expect(violations[0]!.kind).toBe('clipped')
      expect(importableEventSchema.safeParse(event).success).toBe(true)
    })

    it('汎用フィールド 2000文字（ハード上限ちょうど）は clipped・safeParse成功', () => {
      const organizer = 'あ'.repeat(MAX_EVENT_FIELD_HARD_LENGTH)
      const event = baseEvent({ organizer })

      const violations = getEventFieldViolations(event)
      expect(violations).toHaveLength(1)
      expect(violations[0]!.kind).toBe('clipped')
      expect(importableEventSchema.safeParse(event).success).toBe(true)
    })

    it('汎用フィールド 2001文字（ハード上限+1）は rejected・safeParse失敗', () => {
      const organizer = 'あ'.repeat(MAX_EVENT_FIELD_HARD_LENGTH + 1)
      const event = baseEvent({ organizer })

      const violations = getEventFieldViolations(event)
      expect(violations).toHaveLength(1)
      expect(violations[0]!.kind).toBe('rejected')
      expect(importableEventSchema.safeParse(event).success).toBe(false)
    })
  })

  it('null のフィールドはスキップされる（型ガード）', () => {
    const event = baseEvent({ organizer: null, venue: null, city: null, prefecture: null, admissionFee: null })
    expect(getEventFieldViolations(event)).toEqual([])
  })
})
