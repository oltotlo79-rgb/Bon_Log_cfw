// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MAX_GENRES_PER_POST,
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  VALID_POLL_DURATIONS,
} from '@/lib/constants/limits'
import {
  ERR_INVALID_INPUT,
  ERR_CONTENT_REQUIRED,
  ERR_POLL_DATA_INVALID,
  ERR_POLL_INVALID_DURATION,
  ERR_POLL_OPTIONS_COUNT,
  ERR_POLL_OPTION_TOO_LONG,
  ERR_POST_CONTENT_TOO_LONG,
  ERR_GENRE_LIMIT,
} from '@/lib/constants/errors'

// `sanitizePostContent` は HTML サニタイズ済み文字列を返す純粋関数だが、
// テストでは入力が素通りで返る前提に置くことで `parseCreatePostShape` の
// 形状検証ロジックだけを切り出して検証する。
vi.mock('@/lib/sanitize', () => ({
  sanitizePostContent: (s: string | null | undefined) => (s ?? '').trim(),
}))

// `applyCreatePostBusinessRules` から呼ばれる external helper をモックして、
// 業務ルールの分岐順序を deterministic に観測する。
const mockGetMembershipLimits = vi.fn()
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
}))

const mockValidateMediaCounts = vi.fn()
const mockCheckDailyPostLimit = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  validateMediaCounts: (...args: unknown[]) => mockValidateMediaCounts(...args),
  checkDailyPostLimit: (...args: unknown[]) => mockCheckDailyPostLimit(...args),
}))

const mockIsOwnedBonsai = vi.fn()
vi.mock('@/lib/services/bonsai-ownership', () => ({
  isOwnedBonsai: (...args: unknown[]) => mockIsOwnedBonsai(...args),
}))

const FREE_LIMITS = { maxPostLength: 500, maxImagesPerPost: 4, maxVideosPerPost: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetMembershipLimits.mockResolvedValue(FREE_LIMITS)
  mockValidateMediaCounts.mockResolvedValue(undefined)
  mockCheckDailyPostLimit.mockResolvedValue(undefined)
  mockIsOwnedBonsai.mockResolvedValue(false)
})

describe('validatePollOptions', () => {
  it('pollOptionsRaw が null の場合は空 poll として成功する', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions(null, null)
    expect(result).toEqual({ success: true, pollOptions: [], pollDuration: 0 })
  })

  it('pollOptionsRaw が undefined の場合も空 poll として成功する', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions(undefined, undefined)
    expect(result).toEqual({ success: true, pollOptions: [], pollDuration: 0 })
  })

  it('pollOptionsRaw が空文字でも空 poll として成功する', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions('', '3600')
    expect(result).toEqual({ success: true, pollOptions: [], pollDuration: 0 })
  })

  it('JSON でない文字列は ERR_POLL_DATA_INVALID', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions('not-json', '3600')
    expect(result).toMatchObject({ error: ERR_POLL_DATA_INVALID })
  })

  it('配列でない JSON は個数違反として ERR_POLL_OPTIONS_COUNT', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions(JSON.stringify({ a: 1 }), '3600')
    expect(result).toMatchObject({
      error: ERR_POLL_OPTIONS_COUNT(MIN_POLL_OPTIONS, MAX_POLL_OPTIONS),
    })
  })

  it(`MIN_POLL_OPTIONS (${MIN_POLL_OPTIONS}) 未満で ERR_POLL_OPTIONS_COUNT`, async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions(JSON.stringify(['a']), '3600')
    expect(result).toMatchObject({
      error: ERR_POLL_OPTIONS_COUNT(MIN_POLL_OPTIONS, MAX_POLL_OPTIONS),
    })
  })

  it(`MAX_POLL_OPTIONS (${MAX_POLL_OPTIONS}) 超過で ERR_POLL_OPTIONS_COUNT`, async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const tooMany = Array.from({ length: MAX_POLL_OPTIONS + 1 }, (_, i) => `option${i}`)
    const result = validatePollOptions(JSON.stringify(tooMany), '3600')
    expect(result).toMatchObject({
      error: ERR_POLL_OPTIONS_COUNT(MIN_POLL_OPTIONS, MAX_POLL_OPTIONS),
    })
  })

  it(`要素長 ${MAX_POLL_OPTION_LENGTH} 超過で ERR_POLL_OPTION_TOO_LONG`, async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const tooLong = 'a'.repeat(MAX_POLL_OPTION_LENGTH + 1)
    const result = validatePollOptions(JSON.stringify(['ok', tooLong]), '3600')
    expect(result).toMatchObject({ error: ERR_POLL_OPTION_TOO_LONG(MAX_POLL_OPTION_LENGTH) })
  })

  it('空白のみの要素は trim 後ゼロ長として ERR_POLL_OPTION_TOO_LONG', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions(JSON.stringify(['ok', '   ']), '3600')
    expect(result).toMatchObject({ error: ERR_POLL_OPTION_TOO_LONG(MAX_POLL_OPTION_LENGTH) })
  })

  it('VALID_POLL_DURATIONS 外の duration で ERR_POLL_INVALID_DURATION', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions(JSON.stringify(['a', 'b']), '999')
    expect(result).toMatchObject({ error: ERR_POLL_INVALID_DURATION })
  })

  it('pollDurationRaw が null だと 0 扱いで ERR_POLL_INVALID_DURATION', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const result = validatePollOptions(JSON.stringify(['a', 'b']), null)
    expect(result).toMatchObject({ error: ERR_POLL_INVALID_DURATION })
  })

  it('VALID_POLL_DURATIONS の全ての値で成功する', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    for (const d of VALID_POLL_DURATIONS) {
      const result = validatePollOptions(JSON.stringify(['a', 'b']), String(d))
      expect(result).toEqual({ success: true, pollOptions: ['a', 'b'], pollDuration: d })
    }
  })

  it('境界: 要素数ちょうど MIN・MAX は成功', async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const min = Array.from({ length: MIN_POLL_OPTIONS }, (_, i) => `o${i}`)
    const max = Array.from({ length: MAX_POLL_OPTIONS }, (_, i) => `o${i}`)
    const minResult = validatePollOptions(JSON.stringify(min), '3600')
    const maxResult = validatePollOptions(JSON.stringify(max), '3600')
    expect(minResult).toMatchObject({ success: true })
    expect(maxResult).toMatchObject({ success: true })
  })

  it(`境界: 要素長ちょうど ${MAX_POLL_OPTION_LENGTH} は成功`, async () => {
    const { validatePollOptions } = await import('@/lib/actions/post-validation')
    const ok = 'a'.repeat(MAX_POLL_OPTION_LENGTH)
    const result = validatePollOptions(JSON.stringify(['ok', ok]), '3600')
    expect(result).toMatchObject({ success: true })
  })
})

describe('parseCreatePostShape', () => {
  // FormData ヘルパー: 連想配列風に複数値も受け付ける
  function buildForm(values: Record<string, string | string[] | undefined>): FormData {
    const fd = new FormData()
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) continue
      if (Array.isArray(v)) {
        for (const item of v) fd.append(k, item)
      } else {
        fd.append(k, v)
      }
    }
    return fd
  }

  it('最小構成の FormData を受理して sanitize 済み content を返す', async () => {
    const { parseCreatePostShape } = await import('@/lib/actions/post-validation')
    const fd = buildForm({ content: '  hello  ' })
    const result = parseCreatePostShape(fd)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.content).toBe('hello') // sanitize モック = trim
      expect(result.data.genreIds).toEqual([])
      expect(result.data.mediaUrls).toEqual([])
      expect(result.data.mediaTypes).toEqual([])
    }
  })

  it('複数 genreIds と mediaUrls/mediaTypes を集約する', async () => {
    const { parseCreatePostShape } = await import('@/lib/actions/post-validation')
    const fd = buildForm({
      content: 'post',
      genreIds: ['g1', 'g2'],
      mediaUrls: ['https://example.com/a.jpg', 'https://example.com/b.mp4'],
      mediaTypes: ['image', 'video'],
    })
    const result = parseCreatePostShape(fd)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.genreIds).toEqual(['g1', 'g2'])
      expect(result.data.mediaUrls).toEqual([
        'https://example.com/a.jpg',
        'https://example.com/b.mp4',
      ])
      expect(result.data.mediaTypes).toEqual(['image', 'video'])
    }
  })

  it('mediaTypes に enum 外の値が含まれると ERR_INVALID_INPUT', async () => {
    const { parseCreatePostShape } = await import('@/lib/actions/post-validation')
    const fd = buildForm({ mediaTypes: ['image', 'audio'] })
    const result = parseCreatePostShape(fd)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toMatchObject({ error: ERR_INVALID_INPUT })
    }
  })

  it('bonsaiId / pollOptions / pollDuration の絶対値: 未指定なら null になる', async () => {
    // getFormString は absent key に対して null を返す仕様。schema は
    // `.nullable().optional()` なのでこれを受理する。
    const { parseCreatePostShape } = await import('@/lib/actions/post-validation')
    const fd = buildForm({ content: 'x' })
    const result = parseCreatePostShape(fd)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.bonsaiId).toBeNull()
      expect(result.data.pollOptionsRaw).toBeNull()
      expect(result.data.pollDurationRaw).toBeNull()
    }
  })
})

describe('applyCreatePostBusinessRules', () => {
  function baseShape(overrides: Partial<{
    content: string
    genreIds: string[]
    mediaUrls: string[]
    mediaTypes: ('image' | 'video')[]
    bonsaiId: string | null | undefined
    pollOptionsRaw: string | null | undefined
    pollDurationRaw: string | null | undefined
  }> = {}) {
    return {
      content: 'hello',
      genreIds: [] as string[],
      mediaUrls: [] as string[],
      mediaTypes: [] as ('image' | 'video')[],
      bonsaiId: undefined,
      pollOptionsRaw: undefined,
      pollDurationRaw: undefined,
      ...overrides,
    }
  }

  it('content と mediaUrls が両方空なら ERR_CONTENT_REQUIRED', async () => {
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(baseShape({ content: '' }), 'user1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toMatchObject({ error: ERR_CONTENT_REQUIRED })
    }
  })

  it('content が空でも mediaUrls があれば通過する', async () => {
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(
      baseShape({ content: '', mediaUrls: ['url1'], mediaTypes: ['image'] }),
      'user1',
    )
    expect(result.ok).toBe(true)
  })

  it('content が maxPostLength を超えると ERR_POST_CONTENT_TOO_LONG', async () => {
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const tooLong = 'a'.repeat(FREE_LIMITS.maxPostLength + 1)
    const result = await applyCreatePostBusinessRules(baseShape({ content: tooLong }), 'user1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toMatchObject({
        error: ERR_POST_CONTENT_TOO_LONG(FREE_LIMITS.maxPostLength),
      })
    }
  })

  it('content が maxPostLength ちょうどなら通過する', async () => {
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const max = 'a'.repeat(FREE_LIMITS.maxPostLength)
    const result = await applyCreatePostBusinessRules(baseShape({ content: max }), 'user1')
    expect(result.ok).toBe(true)
  })

  it(`genreIds が ${MAX_GENRES_PER_POST} 超で ERR_GENRE_LIMIT`, async () => {
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(
      baseShape({ genreIds: Array.from({ length: MAX_GENRES_PER_POST + 1 }, (_, i) => `g${i}`) }),
      'user1',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toMatchObject({ error: ERR_GENRE_LIMIT(MAX_GENRES_PER_POST) })
    }
  })

  it('validateMediaCounts のエラーをそのまま返す', async () => {
    const mediaError = { success: false as const, error: 'メディア数オーバー' }
    mockValidateMediaCounts.mockResolvedValueOnce(mediaError)
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(baseShape(), 'user1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toBe(mediaError)
    }
  })

  it('poll 検証エラーを返す (不正 JSON)', async () => {
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(
      baseShape({ pollOptionsRaw: 'not-json', pollDurationRaw: '3600' }),
      'user1',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toMatchObject({ error: ERR_POLL_DATA_INVALID })
    }
  })

  it('checkDailyPostLimit のエラーを返す', async () => {
    const limitError = { success: false as const, error: '1日上限到達' }
    mockCheckDailyPostLimit.mockResolvedValueOnce(limitError)
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(baseShape(), 'user1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toBe(limitError)
    }
  })

  it('全検証を通過すると正規化済み data を返す', async () => {
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(
      baseShape({
        content: 'こんにちは',
        genreIds: ['g1'],
        mediaUrls: ['url1'],
        mediaTypes: ['image'],
        pollOptionsRaw: JSON.stringify(['a', 'b']),
        pollDurationRaw: '3600',
      }),
      'user1',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({
        content: 'こんにちは',
        genreIds: ['g1'],
        mediaUrls: ['url1'],
        mediaTypes: ['image'],
        bonsaiId: undefined,
        pollOptions: ['a', 'b'],
        pollDuration: 3600,
      })
    }
  })

  it('検証の順序: content 必須 → 文字数 → ジャンル → media → poll → daily', async () => {
    // すべての check を error にして、最初に弾かれる ERR_CONTENT_REQUIRED が返ることで
    // 短絡順序を確認する
    mockValidateMediaCounts.mockResolvedValue({ success: false, error: 'media' })
    mockCheckDailyPostLimit.mockResolvedValue({ success: false, error: 'daily' })
    const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
    const result = await applyCreatePostBusinessRules(baseShape({ content: '' }), 'user1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.result).toMatchObject({ error: ERR_CONTENT_REQUIRED })
    }
  })

  describe('bonsaiId 所有権検証 (IDOR対策)', () => {
    it('他人所有の bonsaiId は ERR_BONSAI_NOT_FOUND を返し checkDailyPostLimit を消費しない', async () => {
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      mockIsOwnedBonsai.mockResolvedValue(false)
      const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
      const result = await applyCreatePostBusinessRules(
        baseShape({ bonsaiId: 'bonsai-not-mine' }),
        'user1',
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.result).toMatchObject({ error: ERR_BONSAI_NOT_FOUND })
      }
      expect(mockIsOwnedBonsai).toHaveBeenCalledWith('bonsai-not-mine', 'user1')
      expect(mockCheckDailyPostLimit).not.toHaveBeenCalled()
    })

    it('存在しない bonsaiId も ERR_BONSAI_NOT_FOUND を返す（存在有無を区別しない）', async () => {
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      mockIsOwnedBonsai.mockResolvedValue(false)
      const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
      const result = await applyCreatePostBusinessRules(
        baseShape({ bonsaiId: 'nonexistent-bonsai' }),
        'user1',
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.result).toMatchObject({ error: ERR_BONSAI_NOT_FOUND })
      }
    })

    it('本人所有の bonsaiId は通過し data.bonsaiId に反映される', async () => {
      mockIsOwnedBonsai.mockResolvedValue(true)
      const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
      const result = await applyCreatePostBusinessRules(baseShape({ bonsaiId: 'bonsai-1' }), 'user1')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.bonsaiId).toBe('bonsai-1')
      }
      expect(mockCheckDailyPostLimit).toHaveBeenCalled()
    })

    it('bonsaiId 未指定 (undefined) は isOwnedBonsai を呼ばず通過する', async () => {
      const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
      const result = await applyCreatePostBusinessRules(baseShape({ bonsaiId: undefined }), 'user1')
      expect(result.ok).toBe(true)
      expect(mockIsOwnedBonsai).not.toHaveBeenCalled()
    })

    it('bonsaiId が null のときも isOwnedBonsai を呼ばず通過する', async () => {
      const { applyCreatePostBusinessRules } = await import('@/lib/actions/post-validation')
      const result = await applyCreatePostBusinessRules(baseShape({ bonsaiId: null }), 'user1')
      expect(result.ok).toBe(true)
      expect(mockIsOwnedBonsai).not.toHaveBeenCalled()
    })
  })
})
