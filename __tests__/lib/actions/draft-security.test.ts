// @vitest-environment node

/**
 * draft.ts セキュリティ強化テスト
 *
 * deleteDraft の userId 検証テスト（IDOR修正）
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockDraft } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const mockDeleteMediaFiles = vi.fn()
vi.mock('@/lib/services/media-cleanup', () => ({
  deleteMediaFiles: (...args: unknown[]) => mockDeleteMediaFiles(...args),
}))

const importModule = () => import('@/lib/actions/draft')

describe('Draft Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  describe('deleteDraft - IDOR防止', () => {
    it('findFirstでuserIdを含むwhereクエリが実行される', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValue({ ...mockDraft, media: [] })
      mockPrisma.draftPost.delete.mockResolvedValue(mockDraft)

      const { deleteDraft } = await importModule()
      await deleteDraft(mockDraft.id)

      // findFirst で userId を含む検索が行われることを確認（メディア回収用に media も取得）
      expect(mockPrisma.draftPost.findFirst).toHaveBeenCalledWith({
        where: { id: mockDraft.id, userId: mockUser.id },
        include: { media: { select: { url: true } } },
      })
    })

    it('deleteでuserIdを含むwhereクエリが実行される（IDOR防止）', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValue({ ...mockDraft, media: [] })
      mockPrisma.draftPost.delete.mockResolvedValue(mockDraft)

      const { deleteDraft } = await importModule()
      await deleteDraft(mockDraft.id)

      // delete でも userId を含む where が渡されることを確認（IDOR修正の核心）
      expect(mockPrisma.draftPost.delete).toHaveBeenCalledWith({
        where: { id: mockDraft.id, userId: mockUser.id },
      })
    })

    it('他人の下書きIDを指定しても見つからずエラーになる', async () => {
      // findFirst は userId で絞り込むため null を返す
      mockPrisma.draftPost.findFirst.mockResolvedValue(null)

      const { deleteDraft } = await importModule()
      const result = await deleteDraft('other-users-draft-id')

      expect(result).toMatchObject({ success: false, error: '下書きが見つかりません' })
      // delete は呼ばれない
      expect(mockPrisma.draftPost.delete).not.toHaveBeenCalled()
    })
  })
})
