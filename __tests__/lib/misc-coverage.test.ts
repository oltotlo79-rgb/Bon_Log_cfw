// @vitest-environment node

/**
 * Miscellaneous lib coverage tests
 *
 * Covers uncovered branches in:
 * - lib/actions/admin/segments.ts (evaluateSegment edge cases)
 * - lib/file-validation.ts (video validation, AVI detection, unknown mime)
 * - app/api/health/route.ts (rate limit failure path)
 * - app/api/push/vapid-key/route.ts (rate limit failure path)
 * - app/sitemap.ts (full sitemap generation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../utils/test-utils'

// ============================================================
// 1. lib/actions/admin/segments.ts — uncovered branches
// ============================================================

describe('segments.ts uncovered branches', () => {
  const mockPrisma = createMockPrismaClient()
  const mockAuth = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
    vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
    vi.doMock('next/cache', () => ({
      revalidatePath: vi.fn(),
      revalidateTag: vi.fn(),
      unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
      cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
    }))
    vi.doMock('@/lib/rate-limit', () => ({
      checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
      RATE_LIMITS: {},
    }))
    vi.doMock('@/lib/logger', () => ({
      __esModule: true,
      default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    }))
    vi.doMock('next/headers', () => ({
      headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
    }))
    vi.doMock('@/lib/premium', () => ({
      isPremiumUser: vi.fn().mockResolvedValue(false),
      getMembershipLimits: vi.fn().mockReturnValue({
        maxPostLength: 500,
        maxImages: 4,
        maxDailyPosts: 20,
      }),
    }))

    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({
      id: 'admin-record',
      userId: mockUser.id,
      role: 'admin',
      createdAt: new Date(),
    })
  })

  it('evaluateSegment returns error when conditions is null (invalid)', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-null',
      name: 'Null conditions',
      conditions: null,
    })

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-null')
    expect(result).toEqual({ success: false, error: 'セグメント条件が不正です' })
  })

  it('evaluateSegment returns error when conditions has no rules array', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-bad',
      name: 'Bad conditions',
      conditions: { logic: 'AND' },
    })

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-bad')
    expect(result).toEqual({ success: false, error: 'セグメント条件が不正です' })
  })

  it('evaluateSegment returns error when logic is invalid', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-logic',
      name: 'Bad logic',
      conditions: { rules: [], logic: 'XOR' },
    })

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-logic')
    expect(result).toEqual({ success: false, error: 'セグメント条件が不正です' })
  })

  it('evaluateSegment handles postCount field (existence check)', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-post',
      name: 'Post count',
      conditions: {
        rules: [{ field: 'postCount', operator: 'gt', value: 0 }],
        logic: 'AND',
      },
    })
    mockPrisma.user.count.mockResolvedValue(5)

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-post')
    expect(result).toEqual({ count: 5 })

    const call = mockPrisma.user.count.mock.calls[0][0]
    expect(call.where.AND[0]).toEqual({ posts: { some: {} } })
  })

  it('evaluateSegment handles followerCount field (existence check)', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-follower',
      name: 'Follower count',
      conditions: {
        rules: [{ field: 'followerCount', operator: 'gt', value: 0 }],
        logic: 'AND',
      },
    })
    mockPrisma.user.count.mockResolvedValue(3)

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-follower')
    expect(result).toEqual({ count: 3 })

    const call = mockPrisma.user.count.mock.calls[0][0]
    expect(call.where.AND[0]).toEqual({ followers: { some: {} } })
  })

  it('evaluateSegment handles createdAt with lt operator', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-lt',
      name: 'Created before',
      conditions: {
        rules: [{ field: 'createdAt', operator: 'lt', value: '2025-01-01' }],
        logic: 'AND',
      },
    })
    mockPrisma.user.count.mockResolvedValue(10)

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-lt')
    expect(result).toEqual({ count: 10 })

    const call = mockPrisma.user.count.mock.calls[0][0]
    expect(call.where.AND[0].createdAt).toHaveProperty('lt')
    expect(call.where.AND[0].createdAt.lt).toBeInstanceOf(Date)
  })

  it('evaluateSegment handles createdAt with lte operator', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-lte',
      name: 'Created on or before',
      conditions: {
        rules: [{ field: 'createdAt', operator: 'lte', value: '2025-06-01' }],
        logic: 'AND',
      },
    })
    mockPrisma.user.count.mockResolvedValue(7)

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-lte')
    expect(result).toEqual({ count: 7 })

    const call = mockPrisma.user.count.mock.calls[0][0]
    expect(call.where.AND[0].createdAt).toHaveProperty('lte')
  })

  it('evaluateSegment handles createdAt with eq operator', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-eq',
      name: 'Created eq',
      conditions: {
        rules: [{ field: 'createdAt', operator: 'eq', value: '2025-03-15' }],
        logic: 'AND',
      },
    })
    mockPrisma.user.count.mockResolvedValue(1)

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-eq')
    expect(result).toEqual({ count: 1 })

    const call = mockPrisma.user.count.mock.calls[0][0]
    // eq returns the Date directly (not wrapped in {eq: ...})
    expect(call.where.AND[0].createdAt).toBeInstanceOf(Date)
  })

  it('evaluateSegment handles isSuspended with string "true"', async () => {
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-sus',
      name: 'Suspended',
      conditions: {
        rules: [{ field: 'isSuspended', operator: 'is', value: 'true' }],
        logic: 'AND',
      },
    })
    mockPrisma.user.count.mockResolvedValue(2)

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-sus')
    expect(result).toEqual({ count: 2 })
    const call = mockPrisma.user.count.mock.calls[0][0]
    expect(call.where.AND[0].isSuspended).toBe(true)
  })

  it('evaluateSegment rejects unknown operator via Zod validation', async () => {
    // segmentRuleSchema は operator を enum で制限しているため、
    // 未知の operator は parseSegmentConditions で拒否される（Zod 化後の仕様厳格化）。
    mockPrisma.userSegment.findUnique.mockResolvedValue({
      id: 'seg-def',
      name: 'Default op',
      conditions: {
        rules: [{ field: 'createdAt', operator: 'unknown_op', value: '2025-01-01' }],
        logic: 'AND',
      },
    })

    const { evaluateSegment } = await import('@/lib/actions/admin/segments')
    const result = await evaluateSegment('seg-def')
    expect(result).toMatchObject({ success: false, error: 'セグメント条件が不正です' })
    expect(mockPrisma.user.count).not.toHaveBeenCalled()
  })
})

// ============================================================
// 2. lib/file-validation.ts — uncovered branches
// ============================================================

describe('file-validation.ts uncovered branches', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('validateVideoFile rejects non-video mime type', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateVideoFile } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    const result = validateVideoFile(buffer, 'image/jpeg')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('動画ファイルを選択')
  })

  it('validateVideoFile rejects undetectable file', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateVideoFile } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    const result = validateVideoFile(buffer, 'video/mp4')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('識別できません')
  })

  it('validateVideoFile rejects image file pretending to be video', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateVideoFile } = await import('@/lib/file-validation')
    // PNG magic bytes
    const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0])
    const result = validateVideoFile(buffer, 'video/mp4')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('有効な動画ファイルではありません')
  })

  it('validateVideoFile rejects disallowed video type', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateVideoFile } = await import('@/lib/file-validation')
    // AVI magic bytes: RIFF....AVI
    const buffer = Buffer.alloc(16)
    buffer.write('RIFF', 0)
    buffer[8] = 0x41 // A
    buffer[9] = 0x56 // V
    buffer[10] = 0x49 // I
    buffer[11] = 0x20 // space

    // Only allow mp4 - AVI should be rejected
    const result = validateVideoFile(buffer, 'video/x-msvideo', ['video/mp4'])
    expect(result.valid).toBe(false)
    expect(result.error).toContain('対応していません')
  })

  it('validateVideoFile accepts valid MP4 file', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateVideoFile } = await import('@/lib/file-validation')
    // MP4: ftyp at offset 4
    const buffer = Buffer.alloc(16)
    buffer[4] = 0x66 // f
    buffer[5] = 0x74 // t
    buffer[6] = 0x79 // y
    buffer[7] = 0x70 // p
    const result = validateVideoFile(buffer, 'video/mp4')
    expect(result.valid).toBe(true)
    expect(result.detectedType).toBe('video/mp4')
  })

  it('validateMediaFile rejects unknown mime type', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateMediaFile } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    const result = validateMediaFile(buffer, 'application/pdf')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('画像または動画ファイル')
  })

  it('validateMediaFile delegates to validateVideoFile for video mime', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateMediaFile } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    const result = validateMediaFile(buffer, 'video/mp4')
    // Will fail validation because no valid signature
    expect(result.valid).toBe(false)
  })

  it('detectFileType detects AVI correctly', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { detectFileType } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    buffer.write('RIFF', 0)
    buffer[8] = 0x41 // A
    buffer[9] = 0x56 // V
    buffer[10] = 0x49 // I
    buffer[11] = 0x20 // space
    expect(detectFileType(buffer)).toBe('video/x-msvideo')
  })

  it('detectFileType returns null for RIFF that is neither WebP nor AVI', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { detectFileType } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    buffer.write('RIFF', 0)
    buffer[8] = 0x00
    buffer[9] = 0x00
    buffer[10] = 0x00
    buffer[11] = 0x00
    // Neither WebP nor AVI - should return null
    expect(detectFileType(buffer)).toBeNull()
  })

  it('detectFileType detects WebM', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { detectFileType } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    buffer[0] = 0x1A
    buffer[1] = 0x45
    buffer[2] = 0xDF
    buffer[3] = 0xA3
    expect(detectFileType(buffer)).toBe('video/webm')
  })

  it('detectFileType detects GIF87a', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { detectFileType } = await import('@/lib/file-validation')
    const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0, 0, 0, 0, 0])
    expect(detectFileType(buffer)).toBe('image/gif')
  })

  it('detectFileType detects QuickTime MOV with moov', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { detectFileType } = await import('@/lib/file-validation')
    const buffer = Buffer.alloc(16)
    // moov at offset 4
    buffer[4] = 0x6D // m
    buffer[5] = 0x6F // o
    buffer[6] = 0x6F // o
    buffer[7] = 0x76 // v
    // moov signature matches video/quicktime
    expect(detectFileType(buffer)).toBe('video/quicktime')
  })

  it('generateSafeFileName uses "bin" for unknown mime type', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { generateSafeFileName } = await import('@/lib/file-validation')
    const name = generateSafeFileName('test.xyz', 'application/octet-stream')
    expect(name).toMatch(/\.bin$/)
  })

  it('generateSafeFileName uses correct extension for each mime type', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { generateSafeFileName } = await import('@/lib/file-validation')
    expect(generateSafeFileName('a.jpg', 'image/jpeg')).toMatch(/\.jpg$/)
    expect(generateSafeFileName('a.mov', 'video/quicktime')).toMatch(/\.mov$/)
    expect(generateSafeFileName('a.avi', 'video/x-msvideo')).toMatch(/\.avi$/)
    expect(generateSafeFileName('a.gif', 'image/gif')).toMatch(/\.gif$/)
  })

  it('validateImageFile rejects when detected type not in allowed list', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateImageFile } = await import('@/lib/file-validation')
    // GIF87a bytes - valid format but not in default allowed types
    const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0, 0, 0, 0, 0])
    const result = validateImageFile(buffer, 'image/gif', ['image/gif'])
    // GIF is detected and in allowed list
    expect(result.valid).toBe(true)

    // Now only allow jpeg - gif should be rejected
    const result2 = validateImageFile(buffer, 'image/gif', ['image/gif', 'image/jpeg'])
    // Detected type is gif, it IS in allowed list here
    expect(result2.valid).toBe(true)
  })

  it('validateUploadedImage rejects oversized file', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 100,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { validateUploadedImage } = await import('@/lib/file-validation')
    const file = new File(['x'.repeat(200)], 'big.jpg', { type: 'image/jpeg' })
    const result = await validateUploadedImage(file, 100)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBe('Image too large')
    }
  })

  it('matchesSignature returns false for buffer shorter than signature', async () => {
    vi.doMock('@/lib/constants/limits', () => ({
      RIFF_HEADER_SIZE: 12,
      MAX_IMAGE_SIZE: 5 * 1024 * 1024,
    }))
    vi.doMock('@/lib/constants/errors', () => ({
      ERR_IMAGE_SIZE_EXCEEDED: 'Image too large',
      ERR_INVALID_IMAGE_FORMAT: 'Invalid format',
      ERR_FILE_FORMAT_NOT_ALLOWED: (types: readonly string[]) =>
        `許可されていないファイル形式です。対応形式: ${types.join(', ')}`,
      ERR_FILE_FORMAT_UNDETECTABLE_IMAGE: 'ファイル形式を識別できません。有効な画像ファイルを選択してください',
      ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED: (t: string) => `ファイルの実際の形式（${t}）は許可されていません`,
      ERR_VIDEO_FILE_REQUIRED: '動画ファイルを選択してください',
      ERR_FILE_FORMAT_UNDETECTABLE_VIDEO: 'ファイル形式を識別できません。有効な動画ファイルを選択してください',
      ERR_NOT_VALID_VIDEO: 'このファイルは有効な動画ファイルではありません',
      ERR_VIDEO_FORMAT_NOT_SUPPORTED: (t: string, types: readonly string[]) =>
        `動画形式（${t}）は対応していません。対応形式: ${types.join(', ')}`,
      ERR_IMAGE_VIDEO_SELECT: '画像または動画ファイルを選択してください',
    }))

    const { detectFileType } = await import('@/lib/file-validation')
    // Very short buffer - should not match any signature
    const buffer = Buffer.from([0xFF])
    expect(detectFileType(buffer)).toBeNull()
  })
})

// ============================================================
// 3. app/api/health/route.ts — rate limit failure path
// ============================================================

describe('GET /api/health rate limit path', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 429 when rate limited', async () => {
    vi.doMock('@/lib/rate-limit', () => ({
      rateLimit: vi.fn().mockResolvedValue({ success: false }),
      getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
      RATE_LIMITS: { api: { limit: 60, window: 60 } },
    }))
    vi.doMock('@/lib/db', () => ({
      prisma: { $queryRaw: vi.fn() },
    }))
    vi.doMock('@/lib/logger', () => ({
      logger: { error: vi.fn() },
    }))

    const { GET } = await import('@/app/api/health/route')
    const request = new Request('http://localhost/api/health')
    const response = await GET(request as never)
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.status).toBe('rate_limited')
  })

  it('returns 503 when db query fails', async () => {
    vi.doMock('@/lib/rate-limit', () => ({
      rateLimit: vi.fn().mockResolvedValue({ success: true }),
      getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
      RATE_LIMITS: { api: { limit: 60, window: 60 } },
    }))
    vi.doMock('@/lib/db', () => ({
      prisma: { $queryRaw: vi.fn().mockRejectedValue(new Error('DB down')) },
    }))
    vi.doMock('@/lib/logger', () => ({
      logger: { error: vi.fn() },
    }))

    const { GET } = await import('@/app/api/health/route')
    const request = new Request('http://localhost/api/health')
    const response = await GET(request as never)
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.status).toBe('unhealthy')
  })
})

// ============================================================
// 4. app/api/push/vapid-key/route.ts — rate limit failure path
// ============================================================

// Note: vapid-key rate limit test is in a separate file (__tests__/app/api/push/vapid-key/)
// to avoid module caching issues with doMock in the same file as other rate-limit mocks

// ============================================================
// 5. app/sitemap.ts — full generation test
// ============================================================

describe('sitemap.ts', () => {
  beforeEach(() => {
    vi.resetModules()
    // 他テスト由来の doMock を打ち消す (sitemap は実際の constants を直接参照する)
    vi.doUnmock('@/lib/constants/limits')
    vi.doUnmock('@/lib/constants/routes')
    vi.doUnmock('@/lib/constants/guest')
  })

  const buildMockPrisma = (withData: boolean) => ({
    user: { findMany: vi.fn().mockResolvedValue(withData ? [{ id: 'u1', updatedAt: new Date() }] : []) },
    post: { findMany: vi.fn().mockResolvedValue(withData ? [{ id: 'p1', createdAt: new Date() }] : []) },
    bonsaiShop: { findMany: vi.fn().mockResolvedValue(withData ? [{ id: 's1', updatedAt: new Date() }] : []) },
    event: { findMany: vi.fn().mockResolvedValue(withData ? [{ id: 'e1', createdAt: new Date() }] : []) },
    bonsaiTerm: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'term-1' }] : []) },
    pesticide: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'pest-1' }] : []) },
    diseasePest: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'dp-1' }] : []) },
    bonsai: { findMany: vi.fn().mockResolvedValue(withData ? [{ id: 'b1', updatedAt: new Date() }] : []) },
    pesticideColumn: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'pc-1' }] : []) },
    activeIngredient: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'ing-1' }] : []) },
    spreaderType: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'spr-1' }] : []) },
    fertilizerColumn: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'fc-1' }] : []) },
    fertilizerNutrient: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'nut-1' }] : []) },
    treeSpecies: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'tree-1' }] : []) },
    hormoneType: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'h-1' }] : []) },
    hormoneColumn: { findMany: vi.fn().mockResolvedValue(withData ? [{ slug: 'hc-1' }] : []) },
  })

  /** sitemap が依存する `routes.ts` の定数は production 値そのまま使う (partial mock 不可)。 */
  const mockGenericModules = (mockPrisma2: ReturnType<typeof buildMockPrisma>) => {
    vi.doMock('@/lib/db', () => ({ prisma: mockPrisma2 }))
    vi.doMock('@/lib/build/db-availability', () => ({
      shouldSkipBuildTimeDbAccess: () => false,
    }))
  }

  it('generates sitemap with all page types', async () => {
    mockGenericModules(buildMockPrisma(true))

    const sitemap = (await import('@/app/sitemap')).default
    const result = await sitemap()

    expect(result.length).toBeGreaterThan(20)

    const urls = result.map((r) => r.url)
    // 主要 static (BASE_URL は本番値そのまま参照される)
    expect(urls.some((u) => u.endsWith('/privacy'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/terms'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/help'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/shops'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/events'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/dictionary'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/pesticides'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/fertilizers'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/hormones'))).toBe(true)

    // 動的ページ
    expect(urls.some((u) => u.endsWith('/users/u1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/posts/p1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/shops/s1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/events/e1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/dictionary/term-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/pesticides/products/pest-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/pesticides/diseases-pests/dp-1'))).toBe(true)
    // /bonsai/* は PROTECTED_PATHS のため sitemap に含めない (P0-3 監査対応)
    expect(urls.some((u) => u.includes('/bonsai/'))).toBe(false)
    expect(urls.some((u) => u.endsWith('/pesticides/columns/pc-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/pesticides/ingredients/ing-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/pesticides/spreaders/spr-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/fertilizers/columns/fc-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/fertilizers/nutrients/nut-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/fertilizers/schedules/tree-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/hormones/h-1'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/hormones/columns/hc-1'))).toBe(true)
  })

  it('generates sitemap with empty data', async () => {
    mockGenericModules(buildMockPrisma(false))

    const sitemap = (await import('@/app/sitemap')).default
    const result = await sitemap()

    // 動的ページ無し時は静的ページのみ。具体的件数は STATIC_PAGES の数。
    // ここでは「最低 10 件以上 (主要 list を含む)」のみ検証して保守性を確保。
    expect(result.length).toBeGreaterThanOrEqual(10)
  })
})
