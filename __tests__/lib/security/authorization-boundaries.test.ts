// @vitest-environment node

/**
 * セキュリティ境界テスト
 *
 * 認可・認証・レート制限・入力サニタイズ・ファイル検証など、
 * セキュリティ上重要な境界条件をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// ============================================================
// モック設定
// ============================================================

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
const mockCheckDailyLimit = vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
  RATE_LIMITS: {
    post: { windowMs: 60000, maxRequests: 3 },
    delete_post: { windowMs: 60000, maxRequests: 5 },
    upload: { windowMs: 60000, maxRequests: 5 },
  },
}))

const mockGetMembershipLimits = vi.fn().mockResolvedValue({
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
})
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizePostContent: (content: string) => content,
}))

vi.mock('@/lib/cache', () => ({
  getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }),
  revalidateTrendingGenresCache: vi.fn(),
  revalidatePopularTagsCache: vi.fn(),
}))

vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
  extractHashtags: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/services/mention', () => ({
  notifyMentionedUsers: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

// Redis モック（checkDailyPostLimit で使用）
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
}))

// next/headers モック（getClientIp で使用）
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}))

// ============================================================
// テスト
// ============================================================

describe('セキュリティ境界テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id, email: mockUser.email },
    })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  // ============================================================
  // 1. レート制限の適用確認
  // ============================================================
  describe('レート制限の適用', () => {
    it('レート制限超過時にcreatePostがエラーを返す', async () => {
      // requireActiveUser 内の checkUserRateLimit が失敗を返す
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        '操作が多すぎます。しばらく待ってから再試行してください'
      )
    })

    it('レート制限超過時にuploadPostMediaがエラーを返す', async () => {
      // 認証 → 入力検証 (magic byte) → rate-limit の順序のため、file 検証を通せる
      // 実 JPEG マジックバイト (FF D8 FF E0) を埋め込んでから rate-limit を fail させる
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
      const file = new File([jpegHeader], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        'アップロードが多すぎます。しばらく待ってから再試行してください'
      )
    })
  })

  // ============================================================
  // 2. 自分以外のリソース削除の拒否（IDOR防止）
  // ============================================================
  describe('認可: 他ユーザーの投稿削除拒否（IDOR防止）', () => {
    it('他ユーザーの投稿を削除しようとするとエラーを返す', async () => {
      // 投稿は別のユーザーが所有
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: 'other-user-id',
      })
      // ゲストチェック用: ゲストでないことを確認
      mockPrisma.user.findUnique.mockResolvedValue({
        isSuspended: false,
        email: mockUser.email,
      })

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('target-post-id')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('削除権限がありません')
    })

    it('存在しない投稿を削除しようとするとエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('nonexistent-post-id')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('削除権限がありません')
    })

    it('自分の投稿は正常に削除できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: mockUser.id,
        media: [],
      })
      mockPrisma.post.delete.mockResolvedValue({})

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('my-post-id')

      expect(result.success).toBe(true)
    })
  })

  // ============================================================
  // 3. ゲストユーザーの制限
  // ============================================================
  describe('ゲストユーザーの制限', () => {
    it('ゲストユーザーはrequireNotGuestでブロックされる', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      mockAuth.mockResolvedValue({
        user: { id: 'guest-user-id', email: GUEST_EMAIL },
      })

      const { requireNotGuest } = await import('@/lib/actions/utils')
      const result = await requireNotGuest()

      expect(result).not.toBeNull()
      expect(result?.error).toBe(
        '投稿やコメントなどの作成は新規登録後にご利用いただけます。'
      )
    })

    it('通常ユーザーはrequireNotGuestを通過する', async () => {
      mockAuth.mockResolvedValue({
        user: { id: mockUser.id, email: 'normal@example.com' },
      })

      const { requireNotGuest } = await import('@/lib/actions/utils')
      const result = await requireNotGuest()

      expect(result).toBeNull()
    })

    it('ゲストユーザーはcreatePostで投稿できない', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      mockAuth.mockResolvedValue({
        user: { id: 'guest-user-id', email: GUEST_EMAIL },
      })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'ゲストの投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        '投稿やコメントなどの作成は新規登録後にご利用いただけます。'
      )
    })
  })

  // ============================================================
  // 4. 管理者権限の要求
  // ============================================================
  describe('管理者権限の要求', () => {
    it('非管理者ユーザーはrequireAdminでブロックされる', async () => {
      mockAuth.mockResolvedValue({
        user: { id: mockUser.id },
      })
      // adminUser テーブルにレコードがない = 管理者でない
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toBe('管理者権限が必要です')
      }
    })

    it('管理者ユーザーはrequireAdminを通過する', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-user-id' },
      })
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        role: 'admin',
      })

      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect('error' in result).toBe(false)
      if (!('error' in result)) {
        expect(result.userId).toBe('admin-user-id')
        expect(result.role).toBe('admin')
      }
    })

    it('未認証ユーザーはrequireAdminでブロックされる', async () => {
      mockAuth.mockResolvedValue(null)

      const { requireAdmin } = await import('@/lib/actions/utils')
      const result = await requireAdmin()

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error).toBe('認証が必要です')
      }
    })
  })

  // ============================================================
  // 5. 入力サニタイズ
  // ============================================================
  describe('入力サニタイズ', () => {
    // sanitize は実装をテストするので unmock
    beforeEach(() => {
      vi.unmock('@/lib/sanitize')
    })

    it('HTMLタグを除去する', async () => {
      const { sanitizePostContent } = await import('@/lib/sanitize')

      const result = sanitizePostContent('<b>太字</b>テキスト')
      expect(result).not.toContain('<b>')
      expect(result).not.toContain('</b>')
      expect(result).toContain('太字')
      expect(result).toContain('テキスト')
    })

    it('scriptタグとその内容を完全に除去する', async () => {
      const { sanitizePostContent } = await import('@/lib/sanitize')

      const malicious = '<script>alert("XSS")</script>安全なテキスト'
      const result = sanitizePostContent(malicious)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('安全なテキスト')
    })

    it('連続する改行を2つに制限する', async () => {
      const { sanitizePostContent } = await import('@/lib/sanitize')

      const input = '行1\n\n\n\n\n行2'
      const result = sanitizePostContent(input)

      // 3つ以上の連続改行が2つに正規化される
      expect(result).toBe('行1\n\n行2')
    })

    it('null/undefined入力に空文字列を返す', async () => {
      const { sanitizePostContent } = await import('@/lib/sanitize')

      expect(sanitizePostContent(null)).toBe('')
      expect(sanitizePostContent(undefined)).toBe('')
      expect(sanitizePostContent('')).toBe('')
    })

    it('前後の空白を除去する', async () => {
      const { sanitizePostContent } = await import('@/lib/sanitize')

      const result = sanitizePostContent('  テキスト  ')
      expect(result).toBe('テキスト')
    })

    it('styleタグとその内容を除去する', async () => {
      const { sanitizePostContent } = await import('@/lib/sanitize')

      const input = '<style>body{display:none}</style>表示テキスト'
      const result = sanitizePostContent(input)

      expect(result).not.toContain('<style>')
      expect(result).not.toContain('display:none')
      expect(result).toContain('表示テキスト')
    })
  })

  // ============================================================
  // 6. ファイルバリデーション（マジックバイト検証）
  // ============================================================
  describe('ファイルバリデーション', () => {
    it('正当なJPEGファイルを受け入れる', async () => {
      const { validateImageFile } = await import('@/lib/file-validation')

      // JPEG JFIF マジックバイト
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
      ])
      const result = validateImageFile(jpegBuffer, 'image/jpeg')

      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('image/jpeg')
    })

    it('正当なPNGファイルを受け入れる', async () => {
      const { validateImageFile } = await import('@/lib/file-validation')

      // PNG マジックバイト
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      ])
      const result = validateImageFile(pngBuffer, 'image/png')

      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('image/png')
    })

    it('MIMEタイプを偽装したファイルを拒否する（拡張子はjpegだが中身はテキスト）', async () => {
      const { validateImageFile } = await import('@/lib/file-validation')

      // テキストファイルの内容（画像のマジックバイトと一致しない）
      const textBuffer = Buffer.from('This is not an image file at all')
      const result = validateImageFile(textBuffer, 'image/jpeg')

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('許可されていないMIMEタイプを拒否する', async () => {
      const { validateImageFile } = await import('@/lib/file-validation')

      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00])
      const result = validateImageFile(buffer, 'application/pdf')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('許可されていないファイル形式')
    })

    it('空のバッファを拒否する', async () => {
      const { validateImageFile } = await import('@/lib/file-validation')

      const emptyBuffer = Buffer.from([])
      const result = validateImageFile(emptyBuffer, 'image/jpeg')

      expect(result.valid).toBe(false)
    })

    it('実際のMIMEタイプと主張が異なる場合でも検出タイプが許可リストにあれば受け入れる', async () => {
      const { validateImageFile } = await import('@/lib/file-validation')

      // PNGマジックバイトだがimage/jpegと主張
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      ])
      // 主張はjpegだが実際はpng — 両方許可リストにあるので通る
      const result = validateImageFile(pngBuffer, 'image/jpeg')

      expect(result.valid).toBe(true)
      expect(result.detectedType).toBe('image/png')
    })

    it('動画ファイル用の検証がimage/jpeg主張のテキストを拒否する', async () => {
      const { validateVideoFile } = await import('@/lib/file-validation')

      const textBuffer = Buffer.from('Not a video file')
      const result = validateVideoFile(textBuffer, 'video/mp4')

      expect(result.valid).toBe(false)
    })
  })

  // ============================================================
  // 7. アカウント停止チェック
  // ============================================================
  describe('アカウント停止チェック', () => {
    it('停止中のアカウントはcreatePostでブロックされる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '停止中ユーザーの投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('アカウントが停止されています')
    })
  })
})
