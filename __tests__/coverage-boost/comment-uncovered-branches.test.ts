// @vitest-environment node

/**
 * comment.ts uncovered branches:
 * - Line 139: notifyCommentParticipants .catch() error logging path
 * - Line 413: validateImageFile returns { valid: false, error: undefined }
 *   triggering the fallback `validation.error || ERR_IMAGE_VIDEO_SELECT`
 */

import { vi } from 'vitest'

export {}

// --- Mocks ---
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma = {
  comment: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  post: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  block: { findMany: vi.fn() },
  like: { findMany: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  commentThreadMute: { findMany: vi.fn() },
  $transaction: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() }
vi.mock('@/lib/logger', () => ({ default: mockLogger }))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true }),
  RATE_LIMITS: { comment: {}, upload: {}, delete_comment: {} },
}))

const mockNotifyCommentParticipants = vi.fn()
vi.mock('@/lib/services/comment-notifications', () => ({
  notifyCommentParticipants: (...args: unknown[]) => mockNotifyCommentParticipants(...args),
}))

const mockValidateImageFile = vi.fn()
const mockGenerateSafeFileName = vi.fn((name: string) => name)
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: (...args: unknown[]) => mockValidateImageFile(...args),
  generateSafeFileName: (...args: unknown[]) => mockGenerateSafeFileName(...(args as [string])),
}))

vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({ success: true, url: '/test.jpg' }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
  mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
  // コメント対象投稿は閲覧可能（本人の非表示でない投稿）を既定とする
  mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1', isHidden: false })
})

describe('createComment - notifyCommentParticipants error path (line 139)', () => {
  it('logs error when notifyCommentParticipants rejects, but still returns success', async () => {
    // Setup: $transaction returns a successful comment creation
    const mockComment = { id: 'c1', postId: 'p1', userId: 'u1', content: 'test' }
    mockPrisma.$transaction.mockImplementation(async () => {
      return { limitExceeded: false, comment: mockComment }
    })

    // Make notifyCommentParticipants reject
    const notifyError = new Error('notification service down')
    mockNotifyCommentParticipants.mockRejectedValue(notifyError)

    const { createComment } = await import('@/lib/actions/comment')
    const formData = new FormData()
    formData.append('postId', 'p1')
    formData.append('content', 'テストコメント')

    const result = await createComment(formData)

    // The comment creation should still succeed
    expect(result.success).toBe(true)

    // Wait for the void promise to settle
    await new Promise((resolve) => setTimeout(resolve, 10))

    // The catch handler should have logged the error
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to send comment notifications',
      expect.objectContaining({
        commentId: 'c1',
        postId: 'p1',
        actorId: 'u1',
        error: 'notification service down',
      })
    )
  })

  it('logs stringified error when notifyCommentParticipants rejects with non-Error', async () => {
    const mockComment = { id: 'c2', postId: 'p1', userId: 'u1', content: 'test' }
    mockPrisma.$transaction.mockImplementation(async () => {
      return { limitExceeded: false, comment: mockComment }
    })

    // Reject with a non-Error value
    mockNotifyCommentParticipants.mockRejectedValue('string error')

    const { createComment } = await import('@/lib/actions/comment')
    const formData = new FormData()
    formData.append('postId', 'p1')
    formData.append('content', 'テスト')

    await createComment(formData)
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to send comment notifications',
      expect.objectContaining({
        error: 'string error',
      })
    )
  })
})

describe('uploadCommentMedia - image validation error without error message (line 413)', () => {
  it('returns ERR_IMAGE_VIDEO_SELECT when validateImageFile fails with no error message', async () => {
    // validateImageFile returns { valid: false } without an error property
    mockValidateImageFile.mockReturnValue({ valid: false })

    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadCommentMedia(formData)

    expect('error' in result && result.error).toBe('画像または動画ファイルを選択してください')
  })

  it('returns the specific validation error when validateImageFile provides one', async () => {
    mockValidateImageFile.mockReturnValue({ valid: false, error: 'ファイル形式が不正です' })

    const { uploadCommentMedia } = await import('@/lib/actions/comment')
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(4))
    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadCommentMedia(formData)

    expect('error' in result && result.error).toBe('ファイル形式が不正です')
  })
})
