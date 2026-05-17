// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- mocks (vi.hoisted to avoid TDZ issues with vi.mock hoisting) ---

const { mockRedis, mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
  mockPrisma: {
    ngWord: { findMany: vi.fn() },
    moderationQueue: { create: vi.fn() },
  },
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  },
}))

vi.mock('@/lib/redis', () => ({ getRedisClient: () => mockRedis }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: mockLogger,
}))

import {
  invalidateNgWordsCache,
  checkNgWords,
  checkAndEnqueue,
} from '@/lib/ng-word-checker'

beforeEach(() => {
  vi.clearAllMocks()
  mockRedis.get.mockResolvedValue(null)
  mockRedis.set.mockResolvedValue('OK')
  mockRedis.del.mockResolvedValue(1)
  mockPrisma.ngWord.findMany.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// invalidateNgWordsCache
// ---------------------------------------------------------------------------
describe('invalidateNgWordsCache', () => {
  it('calls redis.del with the correct cache key', async () => {
    await invalidateNgWordsCache()
    expect(mockRedis.del).toHaveBeenCalledWith('ng_words:active')
  })

  it('handles redis error gracefully without throwing', async () => {
    mockRedis.del.mockRejectedValue(new Error('Redis down'))
    await expect(invalidateNgWordsCache()).resolves.toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('calls del exactly once', async () => {
    await invalidateNgWordsCache()
    expect(mockRedis.del).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// checkNgWords
// ---------------------------------------------------------------------------
describe('checkNgWords', () => {
  // --- empty / no NG words ---
  it('returns no match for empty string', async () => {
    const result = await checkNgWords('')
    expect(result).toEqual({ matched: false, matchedWords: [], categories: [] })
  })

  it('returns no match for whitespace-only string', async () => {
    const result = await checkNgWords('   ')
    expect(result).toEqual({ matched: false, matchedWords: [], categories: [] })
  })

  it('returns no match when NG word list is empty', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([])
    const result = await checkNgWords('hello world')
    expect(result.matched).toBe(false)
    expect(result.matchedWords).toHaveLength(0)
  })

  // --- simple string match ---
  it('detects a simple string match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'badword', isRegex: false, category: 'spam' },
    ])
    const result = await checkNgWords('This contains badword in it')
    expect(result.matched).toBe(true)
    expect(result.matchedWords).toContain('badword')
  })

  it('does not match when word is absent', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'badword', isRegex: false, category: 'spam' },
    ])
    const result = await checkNgWords('This is a clean sentence')
    expect(result.matched).toBe(false)
  })

  // --- case-insensitive ---
  it('matches case-insensitively for plain words', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'BadWord', isRegex: false, category: 'abuse' },
    ])
    const result = await checkNgWords('BADWORD appears here')
    expect(result.matched).toBe(true)
    expect(result.matchedWords).toContain('BadWord')
  })

  it('matches case-insensitively for regex words', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'bad\\w+', isRegex: true, category: 'abuse' },
    ])
    const result = await checkNgWords('BADWORD appears here')
    expect(result.matched).toBe(true)
  })

  // --- regex match ---
  it('detects a regex pattern match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'sp[a@]m', isRegex: true, category: 'spam' },
    ])
    const result = await checkNgWords('This is sp@m')
    expect(result.matched).toBe(true)
    expect(result.matchedWords).toContain('sp[a@]m')
  })

  it('handles regex that does not match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: '^exactstart', isRegex: true, category: 'spam' },
    ])
    const result = await checkNgWords('no exactstart here')
    // normalizedText = "no exactstart here", does not start with exactstart
    expect(result.matched).toBe(false)
  })

  it('handles invalid regex gracefully', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: '[invalid', isRegex: true, category: 'spam' },
    ])
    const result = await checkNgWords('some text')
    // 無効な正規表現はプリコンパイル段階でスキップされるためマッチしない
    expect(result.matched).toBe(false)
    // コンパイル失敗時にwarnログが出力される
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  // --- multiple matches ---
  it('detects multiple NG words in one text', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'spam', isRegex: false, category: 'spam' },
      { word: 'abuse', isRegex: false, category: 'abuse' },
      { word: 'clean', isRegex: false, category: 'other' },
    ])
    const result = await checkNgWords('spam and abuse detected')
    expect(result.matched).toBe(true)
    expect(result.matchedWords).toEqual(['spam', 'abuse'])
    expect(result.categories).toContain('spam')
    expect(result.categories).toContain('abuse')
    expect(result.categories).not.toContain('other')
  })

  // --- categories ---
  it('collects categories correctly with no duplicates', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'word1', isRegex: false, category: 'catA' },
      { word: 'word2', isRegex: false, category: 'catA' },
      { word: 'word3', isRegex: false, category: 'catB' },
    ])
    const result = await checkNgWords('word1 word2 word3')
    expect(result.categories).toEqual(['catA', 'catB'])
  })

  it('returns empty categories when no match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'missing', isRegex: false, category: 'catA' },
    ])
    const result = await checkNgWords('nothing here')
    expect(result.categories).toHaveLength(0)
  })

  // --- Redis cache hit ---
  it('uses cached NG words from Redis when available', async () => {
    const cached = [{ word: 'cached', isRegex: false, category: 'spam' }]
    mockRedis.get.mockResolvedValue(JSON.stringify(cached))
    const result = await checkNgWords('this is cached content')
    expect(result.matched).toBe(true)
    expect(mockPrisma.ngWord.findMany).not.toHaveBeenCalled()
  })

  it('uses cached NG words when Redis returns parsed object', async () => {
    const cached = [{ word: 'objcache', isRegex: false, category: 'spam' }]
    mockRedis.get.mockResolvedValue(cached)
    const result = await checkNgWords('objcache present')
    expect(result.matched).toBe(true)
    expect(mockPrisma.ngWord.findMany).not.toHaveBeenCalled()
  })

  // --- Redis cache miss -> DB + cache write ---
  it('queries DB and writes cache on Redis miss', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'fromdb', isRegex: false, category: 'db' },
    ])
    const result = await checkNgWords('fromdb text')
    expect(result.matched).toBe(true)
    expect(mockPrisma.ngWord.findMany).toHaveBeenCalled()
    expect(mockRedis.set).toHaveBeenCalledWith(
      'ng_words:active',
      expect.any(String),
      { ex: 300 },
    )
  })

  // --- Redis error fallback ---
  it('falls back to DB when Redis.get throws', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis read error'))
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'fallback', isRegex: false, category: 'test' },
    ])
    const result = await checkNgWords('fallback scenario')
    expect(result.matched).toBe(true)
    expect(mockPrisma.ngWord.findMany).toHaveBeenCalled()
  })

  it('handles Redis.set failure gracefully after DB query', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockRejectedValue(new Error('Redis write error'))
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'writeok', isRegex: false, category: 'test' },
    ])
    const result = await checkNgWords('writeok here')
    expect(result.matched).toBe(true)
  })

  // --- substring matching ---
  it('matches NG word as substring', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'bad', isRegex: false, category: 'abuse' },
    ])
    const result = await checkNgWords('verybadthing')
    expect(result.matched).toBe(true)
  })

  // --- mixed regex and plain words ---
  it('handles mix of regex and plain NG words', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'plain', isRegex: false, category: 'catA' },
      { word: 'r[e3]gex', isRegex: true, category: 'catB' },
    ])
    const result = await checkNgWords('this has plain and r3gex')
    expect(result.matched).toBe(true)
    expect(result.matchedWords).toEqual(['plain', 'r[e3]gex'])
    expect(result.categories).toEqual(['catA', 'catB'])
  })

  // --- DB query parameters ---
  it('queries DB with isActive filter', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockPrisma.ngWord.findMany.mockResolvedValue([])
    await checkNgWords('test')
    expect(mockPrisma.ngWord.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { word: true, isRegex: true, category: true },
    })
  })
})

// ---------------------------------------------------------------------------
// checkAndEnqueue
// ---------------------------------------------------------------------------
describe('checkAndEnqueue', () => {
  it('does not create a queue entry when no NG words match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([])
    const result = await checkAndEnqueue('clean text', 'post', 'post-1')
    expect(result.flagged).toBe(false)
    expect(result.matchedWords).toHaveLength(0)
    expect(mockPrisma.moderationQueue.create).not.toHaveBeenCalled()
  })

  it('creates a ModerationQueue entry when NG words match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'spam', isRegex: false, category: 'spam' },
    ])
    mockPrisma.moderationQueue.create.mockResolvedValue({})
    const result = await checkAndEnqueue('spam content', 'post', 'post-123')
    expect(result.flagged).toBe(true)
    expect(result.matchedWords).toContain('spam')
    expect(mockPrisma.moderationQueue.create).toHaveBeenCalledWith({
      data: {
        targetType: 'post',
        targetId: 'post-123',
        status: 'auto_flagged',
        reason: expect.stringContaining('spam'),
        matchedWords: ['spam'],
      },
    })
  })

  it('passes targetType "comment" correctly', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'abuse', isRegex: false, category: 'abuse' },
    ])
    mockPrisma.moderationQueue.create.mockResolvedValue({})
    await checkAndEnqueue('abuse here', 'comment', 'comment-456')
    expect(mockPrisma.moderationQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetType: 'comment',
        targetId: 'comment-456',
      }),
    })
  })

  it('includes all matched categories in the reason', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'word1', isRegex: false, category: 'catA' },
      { word: 'word2', isRegex: false, category: 'catB' },
    ])
    mockPrisma.moderationQueue.create.mockResolvedValue({})
    await checkAndEnqueue('word1 and word2', 'post', 'p-1')
    const callArgs = mockPrisma.moderationQueue.create.mock.calls[0][0]
    expect(callArgs.data.reason).toContain('catA')
    expect(callArgs.data.reason).toContain('catB')
  })

  it('includes all matched words in the queue entry', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'ng1', isRegex: false, category: 'test' },
      { word: 'ng2', isRegex: false, category: 'test' },
    ])
    mockPrisma.moderationQueue.create.mockResolvedValue({})
    await checkAndEnqueue('ng1 ng2 text', 'post', 'p-2')
    const callArgs = mockPrisma.moderationQueue.create.mock.calls[0][0]
    expect(callArgs.data.matchedWords).toEqual(['ng1', 'ng2'])
  })

  it('returns flagged false for empty text', async () => {
    const result = await checkAndEnqueue('', 'post', 'p-3')
    expect(result.flagged).toBe(false)
    expect(mockPrisma.moderationQueue.create).not.toHaveBeenCalled()
  })

  it('sets status to auto_flagged in the queue entry', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'flagme', isRegex: false, category: 'test' },
    ])
    mockPrisma.moderationQueue.create.mockResolvedValue({})
    await checkAndEnqueue('flagme', 'post', 'p-4')
    const callArgs = mockPrisma.moderationQueue.create.mock.calls[0][0]
    expect(callArgs.data.status).toBe('auto_flagged')
  })

  it('reason starts with NGワード検出:', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'test', isRegex: false, category: 'general' },
    ])
    mockPrisma.moderationQueue.create.mockResolvedValue({})
    await checkAndEnqueue('test content', 'post', 'p-5')
    const callArgs = mockPrisma.moderationQueue.create.mock.calls[0][0]
    expect(callArgs.data.reason).toMatch(/^NGワード検出:/)
  })

  it('does not create queue entry for whitespace-only text', async () => {
    const result = await checkAndEnqueue('   ', 'post', 'p-ws')
    expect(result.flagged).toBe(false)
    expect(mockPrisma.moderationQueue.create).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// checkNgWords - additional edge cases
// ---------------------------------------------------------------------------
describe('checkNgWords - edge cases', () => {
  it('handles regex with too-long pattern (skipped at compile time)', async () => {
    const longPattern = 'a'.repeat(2000)
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: longPattern, isRegex: true, category: 'long' },
    ])
    const result = await checkNgWords('some text with a in it')
    // Long regex is skipped, so no match
    expect(result.matched).toBe(false)
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('handles Japanese text in NG words', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: '詐欺', isRegex: false, category: 'fraud' },
    ])
    const result = await checkNgWords('これは詐欺サイトです')
    expect(result.matched).toBe(true)
    expect(result.matchedWords).toContain('詐欺')
    expect(result.categories).toContain('fraud')
  })

  it('does not false-positive on partial unicode match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: '盆栽園', isRegex: false, category: 'test' },
    ])
    const result = await checkNgWords('盆栽を楽しむ')
    expect(result.matched).toBe(false)
  })

  it('handles regex error during check gracefully', async () => {
    // 実 `RegExp` の `test` を一時的に throw に置換し、`checkNgWords` 内の try/catch が
    // 機能することを検証する。Zod schema が compiledRegex を `instanceof RegExp` で
    // 検証するため、テストでも実 RegExp を使う必要がある。
    const faultyRegex = /faulty/
    const originalTest = RegExp.prototype.test
    RegExp.prototype.test = vi.fn(() => { throw new Error('regex execution error') })
    try {
      mockRedis.get.mockResolvedValue([
        { word: 'faulty', isRegex: true, category: 'err', compiledRegex: faultyRegex },
      ])
      const result = await checkNgWords('some faulty text')
      // Should not throw; error is caught internally
      expect(result.matched).toBe(false)
      expect(mockLogger.error).toHaveBeenCalled()
    } finally {
      RegExp.prototype.test = originalTest
    }
  })

  it('handles multiple same-category words without duplicate categories', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'spam1', isRegex: false, category: 'spam' },
      { word: 'spam2', isRegex: false, category: 'spam' },
      { word: 'spam3', isRegex: false, category: 'spam' },
    ])
    const result = await checkNgWords('spam1 spam2 spam3')
    expect(result.matched).toBe(true)
    expect(result.matchedWords).toHaveLength(3)
    expect(result.categories).toEqual(['spam'])
  })

  it('treats plain words as case-insensitive substring match', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: 'NG', isRegex: false, category: 'test' },
    ])
    const result = await checkNgWords('this is a ngword')
    expect(result.matched).toBe(true)
  })

  it('regex with anchors works correctly', async () => {
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: '^start', isRegex: true, category: 'test' },
    ])
    const resultMatch = await checkNgWords('start of the text')
    expect(resultMatch.matched).toBe(true)

    // Clear mocks between tests within the same it block
    mockPrisma.ngWord.findMany.mockResolvedValue([
      { word: '^start', isRegex: true, category: 'test' },
    ])
    mockRedis.get.mockResolvedValue(null)
    const resultNoMatch = await checkNgWords('not at the start')
    expect(resultNoMatch.matched).toBe(false)
  })

  it('skips regex entries with compiledRegex undefined (invalid regex)', async () => {
    // From DB: invalid regex that failed to compile -> compiledRegex is undefined
    mockRedis.get.mockResolvedValue([
      { word: '[invalid', isRegex: true, category: 'bad', compiledRegex: undefined },
    ])
    const result = await checkNgWords('[invalid text here')
    expect(result.matched).toBe(false)
  })
})
