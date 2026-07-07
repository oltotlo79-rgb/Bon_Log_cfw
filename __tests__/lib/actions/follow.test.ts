// @vitest-environment node

import { vi } from 'vitest'
// ============================================================================
// インポートとモックのセットアップ
// ============================================================================

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

/**
 * Prismaクライアントのモック
 */
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

/**
 * 認証機能のモック
 */
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

/**
 * キャッシュ再検証のモック
 */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

/**
 * レート制限のモック
 */
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

/**
 * アナリティクスのモック
 */
vi.mock('@/lib/services/analytics-recording', () => ({
  recordNewFollowerService: vi.fn().mockResolvedValue(undefined),
}))

/**
 * 通知機能のモック（createNotification はアトミック dedup 付き）
 */
const mockCreateNotification = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/actions/notification', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

// ============================================================================
// テストスイート
// ============================================================================
describe('Follow Actions', async () => {
  /**
   * 各テスト前の準備
   */
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトで認証済み状態を設定
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // デフォルトでレート制限は通過
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  // ============================================================
  // toggleFollow（フォロー切り替え）
  // ============================================================
  /**
   * toggleFollow関数のテスト
   *
   * この関数は、指定したユーザーへのフォローをON/OFF切り替えます。
   *
   * 処理の流れ：
   * 1. 認証チェック
   * 2. 自分自身へのフォローを禁止
   * 3. 対象ユーザーの存在確認
   * 4. 公開/非公開アカウントの確認
   * 5. 既存のフォロー関係を確認
   * 6. フォローがあれば削除、なければ作成
   * 7. フォロー時は通知を送信
   */
  describe('toggleFollow', async () => {
    /**
     * テストケース1: 未認証の場合
     *
     * フォロー機能は認証が必要。
     */
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    /**
     * テストケース2: 自分自身へのフォローを禁止
     *
     * 自分で自分をフォローすることは意味がないので禁止。
     * 悪意のある操作や誤操作を防ぐ。
     */
    it('自分自身はフォローできない', async () => {
      const { toggleFollow } = await import('@/lib/actions/follow')
      // 自分のIDを渡す
      const result = await toggleFollow(mockUser.id)

      expect(result).toEqual({ success: false, error: '自分自身に対してこの操作はできません' })
    })

    /**
     * テストケース3: 公開アカウントへのフォロー
     *
     * シナリオ：
     * - フォローしていないユーザー
     * - 対象は公開アカウント
     * - フォローを追加する
     *
     * 期待結果：
     * - success: true
     * - following: true
     * - Followレコードが作成される
     * - 相手に通知が送られる
     */
    it('フォローしていない場合は追加する', async () => {
      // まだフォローしていない
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // 公開アカウントのユーザー
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true })
      // フォロー作成成功
      mockPrisma.follow.create.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: true, data: { following: true } })
      // フォローが作成されたことを確認
      expect(mockPrisma.follow.create).toHaveBeenCalled()
      // 通知が作成されたことを確認（createNotification経由）
      expect(mockCreateNotification).toHaveBeenCalledWith({
        userId: 'target-user-id',
        actorId: mockUser.id,
        type: 'follow',
      })
    })

    /**
     * テストケース4: 非公開アカウントへのフォロー
     *
     * 非公開アカウント（鍵アカウント）の場合、
     * 直接フォローはできず、フォローリクエストが必要。
     *
     * プライバシー保護のための仕組み。
     */
    it('非公開アカウントへのフォローはエラーを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // 非公開アカウント（isPublic: false）
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: false })

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({
        success: false,
        error: 'このユーザーは非公開アカウントです。フォローリクエストを送信してください',
      })
      // フォローは作成されない
      expect(mockPrisma.follow.create).not.toHaveBeenCalled()
    })

    /**
     * テストケース5: 存在しないユーザーへのフォロー
     *
     * 無効なユーザーIDが渡された場合のエラーハンドリング。
     */
    it('存在しないユーザーへのフォローはエラーを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // ユーザーが見つからない
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('non-existent-user')

      expect(result).toEqual({ success: false, error: 'ユーザーが見つかりません' })
    })

    it('停止ユーザーへのフォローは拒否する（存在を秘匿）', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      // 自ユーザーの停止チェックと target の適格性判定で user.findUnique を共用するため id で出し分ける
      mockPrisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'suspended-user'
            ? { id: 'suspended-user', isPublic: true, isSuspended: true, email: 's@example.com' }
            : { isSuspended: false },
        ),
      )

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('suspended-user')

      expect(result).toEqual({ success: false, error: 'ユーザーが見つかりません' })
      expect(mockPrisma.follow.create).not.toHaveBeenCalled()
    })

    it('双方向ブロック関係があるユーザーへのフォローは拒否する', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
      mockPrisma.block.findFirst.mockResolvedValueOnce({ blockerId: 'target-user-id' })

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: false, error: 'ユーザーが見つかりません' })
      expect(mockPrisma.follow.create).not.toHaveBeenCalled()
    })

    /**
     * テストケース6: フォロー解除
     *
     * シナリオ：
     * - 既にフォローしているユーザー
     * - フォローを解除する
     *
     * 期待結果：
     * - success: true
     * - following: false
     * - Followレコードが削除される
     */
    it('フォロー済みの場合は解除する', async () => {
      // 既にフォローしている
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      mockPrisma.follow.delete.mockResolvedValue({})

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: true, data: { following: false } })
      expect(mockPrisma.follow.delete).toHaveBeenCalled()
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false })

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: false, error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })

    it('空文字のuserIdはバリデーションエラーを返す', async () => {
      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('')

      expect(result).toEqual(
        expect.objectContaining({ success: false })
      )
    })

    it('トランザクション内でDB例外が発生した場合はエラーを返す', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Deadlock detected'))

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: false, error: 'フォロー操作に失敗しました' })
    })

    it('通知送信が失敗するとフォロー操作全体がエラーを返す', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true })
      mockPrisma.follow.create.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      // createNotificationはawaitされるためエラーが伝播する
      mockCreateNotification.mockRejectedValue(new Error('Notification service down'))

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: false, error: 'フォロー操作に失敗しました' })
    })

    it('フォロー解除時は通知を作成しない', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })
      mockPrisma.follow.delete.mockResolvedValue({})

      const { toggleFollow } = await import('@/lib/actions/follow')
      await toggleFollow('target-user-id')

      expect(mockCreateNotification).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // getFollowers（フォロワー一覧取得）
  // ============================================================
  /**
   * getFollowers関数のテスト
   *
   * この関数は、指定したユーザーのフォロワー一覧を取得します。
   * プロフィールページの「フォロワー」タブで使用。
   */
  describe('getFollowers', async () => {
    /**
     * テストケース: フォロワー一覧の取得
     *
     * follow.findManyでFollowレコードを取得し、
     * followerリレーションからユーザー情報を取得。
     */
    it('フォロワー一覧を取得できる', async () => {
      const mockFollowers = [
        {
          followerId: 'follower-1',
          follower: {
            id: 'follower-1',
            nickname: 'Follower 1',
            avatarUrl: '/avatar1.jpg',
            bio: 'Bio 1',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowers)

      const { getFollowers } = await import('@/lib/actions/follow')
      const result = await getFollowers('target-user-id')

      expect(result.users).toHaveLength(1)
      expect(result.users[0]!.id).toBe('follower-1')
    })

    it('カーソルを指定してページネーションできる', async () => {
      mockPrisma.follow.findMany.mockResolvedValue([])

      const { getFollowers } = await import('@/lib/actions/follow')
      const result = await getFollowers('target-user-id', 'cursor-id', 10)

      expect(result.users).toHaveLength(0)
      expect(result.nextCursor).toBeUndefined()
      expect(mockPrisma.follow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: {
            followerId_followingId: {
              followerId: 'cursor-id',
              followingId: 'target-user-id',
            },
          },
          skip: 1,
        })
      )
    })

    it('limit件取得時はnextCursorを返す', async () => {
      const mockFollowers = Array.from({ length: 20 }, (_, i) => ({
        followerId: `follower-${i}`,
        follower: {
          id: `follower-${i}`,
          nickname: `Follower ${i}`,
          avatarUrl: null,
          bio: null,
        },
      }))
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowers)

      const { getFollowers } = await import('@/lib/actions/follow')
      const result = await getFollowers('target-user-id')

      expect(result.nextCursor).toBe('follower-19')
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false })

      const { getFollowers } = await import('@/lib/actions/follow')
      const result = await getFollowers('target-user-id')

      expect(result).toEqual({ users: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // getFollowing（フォロー中一覧取得）
  // ============================================================
  /**
   * getFollowing関数のテスト
   *
   * この関数は、指定したユーザーがフォローしている人の一覧を取得します。
   * プロフィールページの「フォロー中」タブで使用。
   */
  describe('getFollowing', async () => {
    /**
     * テストケース: フォロー中一覧の取得
     */
    it('フォロー中一覧を取得できる', async () => {
      const mockFollowing = [
        {
          followingId: 'following-1',
          following: {
            id: 'following-1',
            nickname: 'Following 1',
            avatarUrl: '/avatar1.jpg',
            bio: 'Bio 1',
          },
        },
      ]
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowing)

      const { getFollowing } = await import('@/lib/actions/follow')
      const result = await getFollowing('target-user-id')

      expect(result.users).toHaveLength(1)
      expect(result.users[0]!.id).toBe('following-1')
    })

    it('カーソルを指定してページネーションできる', async () => {
      mockPrisma.follow.findMany.mockResolvedValue([])

      const { getFollowing } = await import('@/lib/actions/follow')
      const result = await getFollowing('target-user-id', 'cursor-id', 10)

      expect(result.users).toHaveLength(0)
      expect(result.nextCursor).toBeUndefined()
      expect(mockPrisma.follow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: {
            followerId_followingId: {
              followerId: 'target-user-id',
              followingId: 'cursor-id',
            },
          },
          skip: 1,
        })
      )
    })

    it('limit件取得時はnextCursorを返す', async () => {
      const mockFollowingData = Array.from({ length: 20 }, (_, i) => ({
        followingId: `following-${i}`,
        following: {
          id: `following-${i}`,
          nickname: `Following ${i}`,
          avatarUrl: null,
          bio: null,
        },
      }))
      mockPrisma.follow.findMany.mockResolvedValue(mockFollowingData)

      const { getFollowing } = await import('@/lib/actions/follow')
      const result = await getFollowing('target-user-id')

      expect(result.nextCursor).toBe('following-19')
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false })

      const { getFollowing } = await import('@/lib/actions/follow')
      const result = await getFollowing('target-user-id')

      expect(result).toEqual({ users: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // getFollowStatus（フォロー状態確認）
  // ============================================================
  /**
   * getFollowStatus関数のテスト
   *
   * この関数は、ログインユーザーが指定したユーザーを
   * フォローしているかどうかを確認します。
   *
   * フォローボタンの表示切り替えに使用。
   * - フォローしている → 「フォロー解除」ボタン
   * - フォローしていない → 「フォロー」ボタン
   */
  describe('getFollowStatus', async () => {
    /**
     * テストケース1: フォロー中の場合
     */
    it('フォロー状態を取得できる', async () => {
      // フォローレコードが存在する
      mockPrisma.follow.findUnique.mockResolvedValue({
        followerId: mockUser.id,
        followingId: 'target-user-id',
      })

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(true)
    })

    /**
     * テストケース2: フォローしていない場合
     */
    it('フォローしていない場合はfalseを返す', async () => {
      // フォローレコードが存在しない
      mockPrisma.follow.findUnique.mockResolvedValue(null)

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(false)
    })

    /**
     * テストケース3: 未認証の場合
     *
     * ログインしていない場合は、フォロー状態を確認できないので
     * デフォルトでfalseを返す。
     */
    it('未認証の場合はfalseを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result.following).toBe(false)
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false })

      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('target-user-id')

      expect(result).toEqual({ following: false })
    })

    it('targetUserIdが空文字列の場合はZodバリデーションでfalseを返す', async () => {
      const { getFollowStatus } = await import('@/lib/actions/follow')
      const result = await getFollowStatus('')

      expect(result).toEqual({ following: false })
      // Zod で弾かれるため DB へは問い合わせない
      expect(mockPrisma.follow.findUnique).not.toHaveBeenCalled()
    })

    it('正常なIDの場合は従来通りfindUniqueに解析済みIDが渡される', async () => {
      mockPrisma.follow.findUnique.mockResolvedValue(null)

      const { getFollowStatus } = await import('@/lib/actions/follow')
      await getFollowStatus('valid-target-id')

      expect(mockPrisma.follow.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            followerId_followingId: {
              followerId: mockUser.id,
              followingId: 'valid-target-id',
            },
          },
        })
      )
    })
  })
})

// ============================================================================
// テストの実行方法
// ============================================================================
/**
 * このテストファイルを実行するには：
 *
 * npm test -- __tests__/lib/actions/follow.test.ts
 *
 * ## フォロー機能の実装ポイント
 *
 * 1. 複合主キー
 *    Followテーブルは (followerId, followingId) の複合主キー。
 *    これにより、同じ関係の重複を防ぐ。
 *
 * 2. 自己参照リレーション
 *    UserテーブルとFollowテーブルの関係は「自己参照」。
 *    同じUserテーブルに対して2つのリレーション（follower, following）がある。
 *
 * 3. 非公開アカウントの考慮
 *    SNSでは、非公開アカウント（鍵アカウント）の場合、
 *    フォローリクエストの承認が必要。
 *    このシステムでは別途FollowRequestテーブルで管理。
 */
