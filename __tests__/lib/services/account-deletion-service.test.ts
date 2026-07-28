// @vitest-environment node
/**
 * lib/services/account-deletion-service のユニットテスト
 *
 * deleteUserAccount が $transaction 内で
 *   1. collectOwnedMediaUrls（User.avatarUrl/headerUrl, PostMedia, CommentMedia,
 *      ShopReviewImage, ScheduledPostMedia, DraftPostMedia, BonsaiRecordImage の収集・
 *      重複除去・allowed-origin フィルタ）→ StorageDeletionJob への outbox 登録
 *   2. userAnalytics.deleteMany
 *   3. message.deleteMany
 *   4. conversationParticipant.deleteMany
 *   5. notification.deleteMany
 *   6. user.delete
 * を正しい順序で呼び出すことを検証する。
 *
 * filterOwnStorageUrls は実装（lib/services/media-url-validator）をモックせず実行し、
 * STORAGE_PROVIDER=local（許可プレフィックス '/uploads/'）で allowed-origin フィルタの
 * 実効性を検証する。
 *
 * RefreshToken は User に onDelete: Cascade が設定されているため、
 * user.delete 呼び出し = RefreshToken 失効の根拠として検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma — $transaction を「コールバック実行形式」でモック
// ──────────────────────────────────────────────────
const mockTxUserFindUnique = vi.fn()
const mockTxUserDelete = vi.fn()
const mockTxPostMediaFindMany = vi.fn()
const mockTxCommentMediaFindMany = vi.fn()
const mockTxShopReviewImageFindMany = vi.fn()
const mockTxScheduledPostMediaFindMany = vi.fn()
const mockTxDraftPostMediaFindMany = vi.fn()
const mockTxBonsaiRecordImageFindMany = vi.fn()
const mockTxStorageDeletionJobCreateMany = vi.fn()
const mockTxUserAnalyticsDeleteMany = vi.fn()
const mockTxMessageDeleteMany = vi.fn()
const mockTxConversationParticipantDeleteMany = vi.fn()
const mockTxNotificationDeleteMany = vi.fn()

// $transaction の tx オブジェクト（コールバックに渡されるトランザクションクライアント）
const mockTx = {
  user: {
    findUnique: (...args: unknown[]) => mockTxUserFindUnique(...args),
    delete: (...args: unknown[]) => mockTxUserDelete(...args),
  },
  postMedia: { findMany: (...args: unknown[]) => mockTxPostMediaFindMany(...args) },
  commentMedia: { findMany: (...args: unknown[]) => mockTxCommentMediaFindMany(...args) },
  shopReviewImage: { findMany: (...args: unknown[]) => mockTxShopReviewImageFindMany(...args) },
  scheduledPostMedia: { findMany: (...args: unknown[]) => mockTxScheduledPostMediaFindMany(...args) },
  draftPostMedia: { findMany: (...args: unknown[]) => mockTxDraftPostMediaFindMany(...args) },
  bonsaiRecordImage: { findMany: (...args: unknown[]) => mockTxBonsaiRecordImageFindMany(...args) },
  storageDeletionJob: { createMany: (...args: unknown[]) => mockTxStorageDeletionJobCreateMany(...args) },
  userAnalytics: { deleteMany: (...args: unknown[]) => mockTxUserAnalyticsDeleteMany(...args) },
  message: { deleteMany: (...args: unknown[]) => mockTxMessageDeleteMany(...args) },
  conversationParticipant: {
    deleteMany: (...args: unknown[]) => mockTxConversationParticipantDeleteMany(...args),
  },
  notification: { deleteMany: (...args: unknown[]) => mockTxNotificationDeleteMany(...args) },
}

// $transaction(callback) → callback(mockTx) を実行する実装でモックする
const mockPrismaTransaction = vi.fn().mockImplementation(async (cb: (tx: typeof mockTx) => Promise<void>) => {
  return cb(mockTx)
})

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}))

// ──────────────────────────────────────────────────
// テスト
// ──────────────────────────────────────────────────
describe('deleteUserAccount', () => {
  const USER_ID = 'user-to-delete-01'

  beforeEach(() => {
    vi.clearAllMocks()
    // STORAGE_PROVIDER=local → 許可プレフィックス '/uploads/'（決定的なテストのため明示指定）
    vi.stubEnv('STORAGE_PROVIDER', 'local')

    mockTxUserFindUnique.mockResolvedValue({ avatarUrl: null, headerUrl: null })
    mockTxPostMediaFindMany.mockResolvedValue([])
    mockTxCommentMediaFindMany.mockResolvedValue([])
    mockTxShopReviewImageFindMany.mockResolvedValue([])
    mockTxScheduledPostMediaFindMany.mockResolvedValue([])
    mockTxDraftPostMediaFindMany.mockResolvedValue([])
    mockTxBonsaiRecordImageFindMany.mockResolvedValue([])
    mockTxStorageDeletionJobCreateMany.mockResolvedValue({ count: 0 })
    mockTxUserAnalyticsDeleteMany.mockResolvedValue({ count: 1 })
    mockTxMessageDeleteMany.mockResolvedValue({ count: 2 })
    mockTxConversationParticipantDeleteMany.mockResolvedValue({ count: 1 })
    mockTxNotificationDeleteMany.mockResolvedValue({ count: 3 })
    mockTxUserDelete.mockResolvedValue({ id: USER_ID })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('$transaction が 1 回呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1)
  })

  it('所有メディアが 1 件もない場合は storageDeletionJob.createMany を呼ばないこと', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxStorageDeletionJobCreateMany).not.toHaveBeenCalled()
  })

  it('userAnalytics.deleteMany が userId で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxUserAnalyticsDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    })
  })

  it('message.deleteMany が senderId=userId で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxMessageDeleteMany).toHaveBeenCalledWith({
      where: { senderId: USER_ID },
    })
  })

  it('conversationParticipant.deleteMany が userId で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxConversationParticipantDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    })
  })

  it('notification.deleteMany が OR[{userId},{actorId}] で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxNotificationDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: USER_ID }, { actorId: USER_ID }],
      },
    })
  })

  it('user.delete が id=userId で呼ばれること（RefreshToken Cascade 失効の根拠）', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxUserDelete).toHaveBeenCalledWith({
      where: { id: USER_ID },
    })
  })

  it('削除順序: メディア収集 → userAnalytics → message → conversationParticipant → notification → user.delete', async () => {
    const callOrder: string[] = []
    mockTxUserFindUnique.mockImplementation(async () => {
      callOrder.push('user.findUnique')
      return { avatarUrl: null, headerUrl: null }
    })
    mockTxPostMediaFindMany.mockImplementation(async () => {
      callOrder.push('postMedia')
      return []
    })
    mockTxUserAnalyticsDeleteMany.mockImplementation(async () => {
      callOrder.push('userAnalytics')
      return { count: 0 }
    })
    mockTxMessageDeleteMany.mockImplementation(async () => {
      callOrder.push('message')
      return { count: 0 }
    })
    mockTxConversationParticipantDeleteMany.mockImplementation(async () => {
      callOrder.push('conversationParticipant')
      return { count: 0 }
    })
    mockTxNotificationDeleteMany.mockImplementation(async () => {
      callOrder.push('notification')
      return { count: 0 }
    })
    mockTxUserDelete.mockImplementation(async () => {
      callOrder.push('user.delete')
      return { id: USER_ID }
    })

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(callOrder).toEqual([
      'user.findUnique',
      'postMedia',
      'userAnalytics',
      'message',
      'conversationParticipant',
      'notification',
      'user.delete',
    ])
  })

  it('成功時に void（undefined）を返すこと', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    const result = await deleteUserAccount(USER_ID)

    expect(result).toBeUndefined()
  })

  it('$transaction 内でエラーが発生した場合はスローすること', async () => {
    mockTxUserAnalyticsDeleteMany.mockRejectedValue(new Error('DB constraint error'))

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await expect(deleteUserAccount(USER_ID)).rejects.toThrow('DB constraint error')
  })

  it('user.delete でエラーが発生した場合はスローすること', async () => {
    mockTxUserDelete.mockRejectedValue(new Error('User not found'))

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await expect(deleteUserAccount(USER_ID)).rejects.toThrow('User not found')
  })

  it('異なる userId を渡した場合も正しく呼ばれること', async () => {
    const OTHER_USER_ID = 'another-user-42'
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(OTHER_USER_ID)

    expect(mockTxUserAnalyticsDeleteMany).toHaveBeenCalledWith({ where: { userId: OTHER_USER_ID } })
    expect(mockTxUserDelete).toHaveBeenCalledWith({ where: { id: OTHER_USER_ID } })
  })
})

describe('deleteUserAccount: collectOwnedMediaUrls / ストレージ削除 outbox', () => {
  const USER_ID = 'user-media-01'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('STORAGE_PROVIDER', 'local')

    mockTxUserFindUnique.mockResolvedValue({ avatarUrl: null, headerUrl: null })
    mockTxPostMediaFindMany.mockResolvedValue([])
    mockTxCommentMediaFindMany.mockResolvedValue([])
    mockTxShopReviewImageFindMany.mockResolvedValue([])
    mockTxScheduledPostMediaFindMany.mockResolvedValue([])
    mockTxDraftPostMediaFindMany.mockResolvedValue([])
    mockTxBonsaiRecordImageFindMany.mockResolvedValue([])
    mockTxStorageDeletionJobCreateMany.mockResolvedValue({ count: 0 })
    mockTxUserAnalyticsDeleteMany.mockResolvedValue({ count: 0 })
    mockTxMessageDeleteMany.mockResolvedValue({ count: 0 })
    mockTxConversationParticipantDeleteMany.mockResolvedValue({ count: 0 })
    mockTxNotificationDeleteMany.mockResolvedValue({ count: 0 })
    mockTxUserDelete.mockResolvedValue({ id: USER_ID })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('全メディア種別（avatar/header/post/comment/review/scheduled/draft/bonsai）を収集し重複除去して outbox に登録する', async () => {
    mockTxUserFindUnique.mockResolvedValue({
      avatarUrl: '/uploads/avatars/a.webp',
      headerUrl: '/uploads/headers/h.webp',
    })
    mockTxPostMediaFindMany.mockResolvedValue([
      { url: '/uploads/posts/p1.webp' },
      { url: '/uploads/posts/p1.webp' }, // 重複
    ])
    mockTxCommentMediaFindMany.mockResolvedValue([{ url: '/uploads/comments/c1.webp' }])
    mockTxShopReviewImageFindMany.mockResolvedValue([{ url: '/uploads/reviews/r1.webp' }])
    mockTxScheduledPostMediaFindMany.mockResolvedValue([{ url: '/uploads/scheduled/s1.webp' }])
    mockTxDraftPostMediaFindMany.mockResolvedValue([{ url: '/uploads/drafts/d1.webp' }])
    mockTxBonsaiRecordImageFindMany.mockResolvedValue([{ url: '/uploads/bonsai/b1.webp' }])

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxStorageDeletionJobCreateMany).toHaveBeenCalledTimes(1)
    const callArg = mockTxStorageDeletionJobCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ url: string; ownerUserId: string }>
    }
    const urls = callArg.data.map((d) => d.url)

    expect(urls).toEqual(
      expect.arrayContaining([
        '/uploads/avatars/a.webp',
        '/uploads/headers/h.webp',
        '/uploads/posts/p1.webp',
        '/uploads/comments/c1.webp',
        '/uploads/reviews/r1.webp',
        '/uploads/scheduled/s1.webp',
        '/uploads/drafts/d1.webp',
        '/uploads/bonsai/b1.webp',
      ]),
    )
    // 重複除去: postMedia に同一 URL が 2 件あっても outbox には 1 件のみ
    expect(urls.filter((u) => u === '/uploads/posts/p1.webp')).toHaveLength(1)
    // 全行が ownerUserId=userId を持つこと
    for (const row of callArg.data) {
      expect(row.ownerUserId).toBe(USER_ID)
    }
  })

  it('allowed-origin 外の URL（外部ドメイン）は outbox から除外される', async () => {
    mockTxPostMediaFindMany.mockResolvedValue([
      { url: '/uploads/posts/ok.webp' },
      { url: 'https://evil.example.com/tracker.gif' },
    ])

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    const callArg = mockTxStorageDeletionJobCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ url: string; ownerUserId: string }>
    }
    const urls = callArg.data.map((d) => d.url)

    expect(urls).toContain('/uploads/posts/ok.webp')
    expect(urls).not.toContain('https://evil.example.com/tracker.gif')
  })

  it('null/空文字の avatarUrl・headerUrl は outbox に含まれない', async () => {
    mockTxUserFindUnique.mockResolvedValue({ avatarUrl: null, headerUrl: '' })
    mockTxPostMediaFindMany.mockResolvedValue([{ url: '/uploads/posts/only.webp' }])

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    const callArg = mockTxStorageDeletionJobCreateMany.mock.calls[0]?.[0] as {
      data: Array<{ url: string; ownerUserId: string }>
    }
    expect(callArg.data).toHaveLength(1)
    expect(callArg.data[0]?.url).toBe('/uploads/posts/only.webp')
  })

  it('storageDeletionJob.createMany が reject すると deleteUserAccount 全体が throw する（ロールバック）', async () => {
    mockTxPostMediaFindMany.mockResolvedValue([{ url: '/uploads/posts/p1.webp' }])
    mockTxStorageDeletionJobCreateMany.mockRejectedValue(new Error('outbox insert failed'))

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await expect(deleteUserAccount(USER_ID)).rejects.toThrow('outbox insert failed')

    // outbox 登録失敗以降のステップ（User 削除含む）は実行されない
    expect(mockTxUserAnalyticsDeleteMany).not.toHaveBeenCalled()
    expect(mockTxUserDelete).not.toHaveBeenCalled()
  })
})
