import { vi } from 'vitest'

/**
 * createMockPrismaClient の戻り値型。
 * vi.fn() 戻り値を ReturnType<typeof vi.fn> として型付けし、
 * 各モデルデリゲートのプロパティが undefined にならないことを保証する。
 * これにより noUncheckedIndexedAccess 下での TS18048 を防ぐ。
 *
 * テストファイル側での独自 mockPrisma 定義にも使用可能:
 * ```typescript
 * const mockPrisma: MockPrismaClient = createMockPrismaClient()
 * ```
 */
export type MockPrismaClient = ReturnType<typeof createMockPrismaClient>
/**
 * ============================================================
 * テストユーティリティファイル
 * ============================================================
 *
 * このファイルは、テスト全体で共通して使用する
 * ヘルパー関数やモックデータを提供します。
 *
 * ## このファイルの役割
 * 1. テスト用のモックデータを定義（ユーザー、投稿、コメントなど）
 * 2. Reactコンポーネントのテスト用カスタムレンダラーを提供
 * 3. Prismaデータベースのモッククライアントを提供
 * 4. 便利なユーティリティ関数を提供
 *
 * ## 使い方
 * ```typescript
 * import { render, mockUser, mockPost } from '../utils/test-utils'
 *
 * // コンポーネントをレンダリング
 * render(<MyComponent user={mockUser} />)
 *
 * // モックデータを使用
 * expect(mockUser.nickname).toBe('テストユーザー')
 * ```
 *
 * @module __tests__/utils/test-utils
 */

// ============================================================
// インポート
// ============================================================

/**
 * React本体
 * JSX要素を作成するために必要
 */
import React, { ReactElement } from 'react'

/**
 * Testing Library
 *
 * @see https://testing-library.com/docs/react-testing-library/intro/
 *
 * - render: Reactコンポーネントを仮想DOMにレンダリングする関数
 * - RenderOptions: レンダリングオプションの型定義
 */
import { render, RenderOptions } from '@testing-library/react'

/**
 * TanStack Query（React Query）
 *
 * @see https://tanstack.com/query/latest
 *
 * サーバー状態管理ライブラリ。
 * API呼び出しのキャッシュ、再取得、同期などを管理。
 *
 * - QueryClient: キャッシュを管理するクライアント
 * - QueryClientProvider: コンポーネントツリーにQueryClientを提供
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * NextAuth.js
 *
 * @see https://next-auth.js.org/
 *
 * 認証ライブラリ。ログイン状態を管理。
 *
 * - SessionProvider: セッション情報をコンポーネントツリーに提供
 */
import { SessionProvider } from 'next-auth/react'

// ============================================================
// モックデータ定義
// ============================================================

/**
 * テスト用ユーザーデータ
 *
 * このデータは、テストで「ログイン中のユーザー」として使用されます。
 * 各フィールドは実際のUserモデルと同じ構造になっています。
 *
 * @example
 * ```typescript
 * // ユーザーのニックネームを確認
 * expect(mockUser.nickname).toBe('テストユーザー')
 *
 * // ユーザーIDを使って投稿を作成
 * const post = { userId: mockUser.id, content: 'テスト' }
 * ```
 */
export const mockUser = {
  /** ユーザーの一意識別子（UUID形式） */
  id: 'test-user-id',
  /** ユーザーの表示名 */
  nickname: 'テストユーザー',
  /** ユーザーのメールアドレス */
  email: 'test@example.com',
  /** プロフィール画像のURL */
  avatarUrl: '/test-avatar.jpg',
  /** 自己紹介文 */
  bio: 'テスト用の自己紹介',
  /** プロフィールの公開設定（true: 公開, false: 非公開） */
  isPublic: true,
  /** アカウント作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 最終更新日時 */
  updatedAt: new Date('2024-01-01'),
}

/**
 * テスト用投稿データ
 *
 * SNSの投稿を表すモックデータです。
 * ユーザー情報やいいね数なども含まれています。
 *
 * @example
 * ```typescript
 * // 投稿コンポーネントに渡す
 * render(<PostCard post={mockPost} />)
 *
 * // いいね数を確認
 * expect(mockPost.likeCount).toBe(5)
 * ```
 */
export const mockPost = {
  /** 投稿の一意識別子 */
  id: 'test-post-id',
  /** 投稿者のユーザーID */
  userId: mockUser.id,
  /** 投稿の本文（ハッシュタグを含む） */
  content: 'テスト投稿の内容 #テスト',
  /** 投稿作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 最終更新日時 */
  updatedAt: new Date('2024-01-01'),
  /**
   * 投稿者の情報（ネストされたオブジェクト）
   * 投稿一覧で投稿者のアバターや名前を表示するために使用
   */
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  /** 添付メディア（画像・動画）の配列 */
  media: [],
  /** 投稿に付けられたジャンルタグ */
  genres: [{ id: 'genre-1', name: '松柏類', category: '松柏類' }],
  /** いいねの総数 */
  likeCount: 5,
  /** コメントの総数 */
  commentCount: 3,
  /** 現在のユーザーがいいねしているかどうか */
  isLiked: false,
  /** 現在のユーザーがブックマークしているかどうか */
  isBookmarked: false,
}

/**
 * テスト用コメントデータ
 *
 * 投稿へのコメントを表すモックデータです。
 */
export const mockComment = {
  /** コメントの一意識別子 */
  id: 'test-comment-id',
  /** コメント先の投稿ID */
  postId: mockPost.id,
  /** コメント投稿者のユーザーID */
  userId: mockUser.id,
  /** コメントの本文 */
  content: 'テストコメント',
  /** コメント作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 親コメントID（nullは親コメント） */
  parentId: null,
  /** 削除日時 */
  deletedAt: null,
  /** コメント投稿者の情報 */
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  /** コメントへのいいね数 */
  likeCount: 2,
  /** 現在のユーザーがいいねしているかどうか */
  isLiked: false,
}

/**
 * テスト用セッションデータ
 *
 * NextAuth.jsのセッション情報を模倣したデータです。
 * SessionProviderに渡すことで、テスト中も認証済み状態をシミュレートできます。
 *
 * @example
 * ```typescript
 * // セッションプロバイダーでラップ
 * <SessionProvider session={mockSession}>
 *   <MyComponent />
 * </SessionProvider>
 * ```
 */
export const mockSession = {
  /** セッションに含まれるユーザー情報 */
  user: {
    id: mockUser.id,
    name: mockUser.nickname,
    email: mockUser.email,
    image: mockUser.avatarUrl,
  },
  /** セッションの有効期限（24時間後） */
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

/**
 * テスト用ジャンルデータ
 *
 * 盆栽のジャンル（種類）マスタデータです。
 * 投稿にタグ付けする際に使用されます。
 */
export const mockGenres = [
  { id: 'genre-1', name: '黒松', category: '松柏類', sortOrder: 1 },
  { id: 'genre-2', name: '五葉松', category: '松柏類', sortOrder: 2 },
  { id: 'genre-3', name: 'もみじ', category: '雑木類', sortOrder: 10 },
]

/**
 * テスト用通知データ
 *
 * いいねやフォローなどの通知を表すモックデータです。
 */
export const mockNotification = {
  /** 通知の一意識別子 */
  id: 'notification-1',
  /** 通知を受け取るユーザーのID */
  userId: mockUser.id,
  /** 通知を発生させたユーザーのID（いいねした人など） */
  actorId: 'other-user-id',
  /** 通知の種類（'like', 'follow', 'comment'など） */
  type: 'like',
  /** 関連する投稿のID（いいね通知の場合） */
  postId: mockPost.id,
  /** 既読フラグ */
  isRead: false,
  /** 通知作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 通知を発生させたユーザーの情報 */
  actor: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

/**
 * テスト用会話（DM）データ
 *
 * ダイレクトメッセージの会話を表すモックデータです。
 */
export const mockConversation = {
  /** 会話の一意識別子 */
  id: 'conversation-1',
  /** 会話作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 最終更新日時（最新メッセージの日時） */
  updatedAt: new Date('2024-01-01'),
  /** 会話の参加者リスト */
  participants: [
    {
      userId: mockUser.id,
      user: mockUser,
    },
    {
      userId: 'other-user-id',
      user: {
        id: 'other-user-id',
        nickname: '他のユーザー',
        avatarUrl: '/other-avatar.jpg',
      },
    },
  ],
  /** メッセージの配列 */
  messages: [],
  /** 未読メッセージ数 */
  unreadCount: 0,
}

/**
 * テスト用イベントデータ
 *
 * 盆栽展示会などのイベント情報を表すモックデータです。
 */
export const mockEvent = {
  /** イベントの一意識別子 */
  id: 'test-event-id',
  /** イベント作成者のユーザーID */
  createdBy: mockUser.id,
  /** イベント名 */
  title: 'テストイベント',
  /** 開始日 */
  startDate: new Date('2025-02-01'),
  /** 終了日 */
  endDate: new Date('2025-02-02'),
  /** 開催都道府県 */
  prefecture: '東京都',
  /** 開催市区町村 */
  city: '渋谷区',
  /** 会場名 */
  venue: 'テスト会場',
  /** 主催者名 */
  organizer: 'テスト主催者',
  /** 入場料 */
  admissionFee: '無料',
  /** 即売会の有無 */
  hasSales: true,
  /** イベントの説明文 */
  description: 'テストイベントの説明',
  /** 外部リンク（公式サイトなど） */
  externalUrl: 'https://example.com/event',
  /** 非表示フラグ（通報などで非表示にされた場合true） */
  isHidden: false,
  /** 非表示にされた日時 */
  hiddenAt: null,
  /** 作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
  /** 作成者の情報 */
  creator: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

/**
 * テスト用盆栽園データ
 *
 * 盆栽園（ショップ）の情報を表すモックデータです。
 */
export const mockShop = {
  /** 盆栽園の一意識別子 */
  id: 'test-shop-id',
  /** 盆栽園の名称 */
  name: 'テスト盆栽園',
  /** 住所 */
  address: '東京都渋谷区代々木1-1-1',
  /** 緯度（地図表示用） */
  latitude: 35.6762,
  /** 経度（地図表示用） */
  longitude: 139.6503,
  /** 電話番号 */
  phone: '03-1234-5678',
  /** ウェブサイトURL */
  website: 'https://example.com/shop',
  /** 営業時間 */
  businessHours: '9:00-17:00',
  /** 定休日 */
  closedDays: '水曜日',
  /** 登録者のユーザーID */
  createdBy: mockUser.id,
  /** 非表示フラグ */
  isHidden: false,
  /** 非表示にされた日時 */
  hiddenAt: null,
  /** 作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
  /** 登録者の情報 */
  creator: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  /** 取り扱いジャンル */
  genres: [],
  /** レビュー一覧 */
  reviews: [],
}

/**
 * テスト用レビューデータ
 *
 * 盆栽園へのレビュー（口コミ）を表すモックデータです。
 */
export const mockReview = {
  /** レビューの一意識別子 */
  id: 'test-review-id',
  /** レビュー対象の盆栽園ID */
  shopId: 'test-shop-id',
  /** レビュー投稿者のユーザーID */
  userId: mockUser.id,
  /** 評価（1〜5の星） */
  rating: 5,
  /** レビュー本文 */
  content: 'とても素晴らしい盆栽園です',
  /** 非表示フラグ */
  isHidden: false,
  /** 非表示にされた日時 */
  hiddenAt: null,
  /** 作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
  /** レビュー投稿者の情報 */
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
  /** 添付画像 */
  images: [],
}

/**
 * テスト用通報データ
 *
 * 不適切なコンテンツの通報を表すモックデータです。
 */
export const mockReport = {
  /** 通報の一意識別子 */
  id: 'test-report-id',
  /** 通報者のユーザーID */
  reporterId: mockUser.id,
  /** 通報対象の種類（'post', 'comment', 'user'など） */
  targetType: 'post',
  /** 通報対象のID */
  targetId: 'test-post-id',
  /** 通報理由（'spam', 'harassment'など） */
  reason: 'spam',
  /** 通報の詳細説明 */
  description: 'スパム投稿です',
  /** 通報のステータス（'pending', 'resolved', 'dismissed'） */
  status: 'pending',
  /** 通報日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
  /** 通報者の情報 */
  reporter: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

/**
 * テスト用管理者ユーザーデータ
 *
 * 管理者権限を持つユーザーを表すモックデータです。
 */
export const mockAdminUser = {
  /** 管理者レコードの一意識別子 */
  id: 'admin-id',
  /** 管理者であるユーザーのID */
  userId: mockUser.id,
  /** 管理者ロール（requireAdmin の権限チェック用。'admin' は全権限） */
  role: 'admin' as const,
  /** 管理者権限付与日時 */
  createdAt: new Date('2024-01-01'),
}

/**
 * テスト用管理者通知データ
 *
 * 管理者向けの通知（自動非表示など）を表すモックデータです。
 */
export const mockAdminNotification = {
  /** 通知の一意識別子 */
  id: 'notification-id',
  /** 通知の種類 */
  type: 'auto_hidden',
  /** 対象コンテンツの種類 */
  targetType: 'post',
  /** 対象コンテンツのID */
  targetId: 'test-post-id',
  /** 通知メッセージ */
  message: '投稿が10件の通報を受け自動非表示になりました',
  /** 通報件数 */
  reportCount: 10,
  /** 既読フラグ */
  isRead: false,
  /** 解決済みフラグ */
  isResolved: false,
  /** 解決日時 */
  resolvedAt: null,
  /** 通知作成日時 */
  createdAt: new Date('2024-01-01'),
}

/**
 * テスト用メッセージデータ
 *
 * ダイレクトメッセージを表すモックデータです。
 */
export const mockMessage = {
  /** メッセージの一意識別子 */
  id: 'message-1',
  /** 所属する会話のID */
  conversationId: 'conversation-1',
  /** 送信者のユーザーID */
  senderId: mockUser.id,
  /** メッセージ本文 */
  content: 'テストメッセージです',
  /** 既読フラグ */
  isRead: false,
  /** 送信日時 */
  createdAt: new Date('2024-01-01'),
  /** 送信者の情報 */
  sender: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

/**
 * テスト用下書きデータ
 *
 * 投稿の下書きを表すモックデータです。
 */
export const mockDraft = {
  /** 下書きの一意識別子 */
  id: 'draft-1',
  /** 下書き作成者のユーザーID */
  userId: mockUser.id,
  /** 下書きの本文 */
  content: '下書きの内容',
  /** 添付メディアのURL配列 */
  mediaUrls: [],
  /** 選択されたジャンルID配列 */
  genreIds: ['genre-1'],
  /** 作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
}

/**
 * テスト用予約投稿データ
 *
 * 指定日時に自動公開される予約投稿を表すモックデータです。
 */
export const mockScheduledPost = {
  /** 予約投稿の一意識別子 */
  id: 'scheduled-1',
  /** 予約投稿作成者のユーザーID */
  userId: mockUser.id,
  /** 投稿本文 */
  content: '予約投稿の内容',
  /** 添付メディアのURL配列 */
  mediaUrls: [],
  /** 選択されたジャンルID配列 */
  genreIds: ['genre-1'],
  /** 公開予定日時 */
  scheduledAt: new Date('2024-02-01T10:00:00Z'),
  /**
   * ステータス
   * - 'pending': 予約中（公開待ち）
   * - 'published': 公開済み
   * - 'cancelled': キャンセル済み
   * - 'failed': 公開失敗
   */
  status: 'pending' as const,
  /** 作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
}

/**
 * テスト用盆栽データ
 *
 * ユーザーが登録した盆栽を表すモックデータです。
 */
export const mockBonsai = {
  /** 盆栽の一意識別子 */
  id: 'bonsai-1',
  /** 所有者のユーザーID */
  userId: mockUser.id,
  /** 盆栽の名前（愛称） */
  name: 'テスト黒松',
  /** 樹種 */
  species: '黒松',
  /** 入手日 */
  acquisitionDate: new Date('2020-01-01'),
  /**
   * 入手方法
   * - 'purchase': 購入
   * - 'gift': 贈答
   * - 'grow': 実生・挿し木から育成
   * - 'other': その他
   */
  acquisitionType: 'purchase' as const,
  /** 盆栽の説明 */
  description: 'テスト盆栽の説明',
  /** 盆栽の画像URL */
  imageUrl: '/bonsai-image.jpg',
  /** 公開設定 */
  isPublic: true,
  /** 登録日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
  /** 所有者の情報 */
  user: {
    id: mockUser.id,
    nickname: mockUser.nickname,
    avatarUrl: mockUser.avatarUrl,
  },
}

/**
 * テスト用盆栽記録データ
 *
 * 盆栽の手入れ記録を表すモックデータです。
 */
export const mockBonsaiRecord = {
  /** 記録の一意識別子 */
  id: 'record-1',
  /** 対象盆栽のID */
  bonsaiId: 'bonsai-1',
  /** 記録者のユーザーID */
  userId: mockUser.id,
  /**
   * 記録の種類
   * - 'watering': 水やり
   * - 'fertilizing': 施肥
   * - 'pruning': 剪定
   * - 'repotting': 植替え
   * - 'wiring': 針金かけ
   * - 'other': その他
   */
  recordType: 'watering' as const,
  /** 記録のタイトル */
  title: '水やり記録',
  /** 記録の詳細 */
  description: '朝の水やりを行いました',
  /** 添付画像のURL配列 */
  imageUrls: [],
  /** 記録日 */
  recordDate: new Date('2024-01-15'),
  /** 作成日時 */
  createdAt: new Date('2024-01-15'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-15'),
}

/**
 * テスト用パスワードリセットトークンデータ
 *
 * パスワードリセット用の一時トークンを表すモックデータです。
 */
export const mockPasswordResetToken = {
  /** トークンレコードの一意識別子 */
  id: 'token-1',
  /** リセット対象のメールアドレス */
  email: mockUser.email,
  /** リセットトークン文字列 */
  token: 'reset-token-123',
  /** トークンの有効期限（1時間後） */
  expires: new Date(Date.now() + 60 * 60 * 1000),
  /** トークン作成日時 */
  createdAt: new Date('2024-01-01'),
}

/**
 * テスト用ハッシュタグデータ
 *
 * 投稿で使われるハッシュタグを表すモックデータです。
 */
export const mockHashtag = {
  /** ハッシュタグの一意識別子 */
  id: 'hashtag-1',
  /** ハッシュタグ名（#なし） */
  name: 'テスト',
  /** このタグが使われている投稿数 */
  postCount: 10,
  /** 作成日時 */
  createdAt: new Date('2024-01-01'),
}

/**
 * テスト用ユーザー分析データ
 *
 * ユーザーのプロフィールビューやエンゲージメントを表すモックデータです。
 * プレミアム会員向けの分析機能で使用されます。
 */
export const mockUserAnalytics = {
  /** 分析レコードの一意識別子 */
  id: 'analytics-1',
  /** 分析対象のユーザーID */
  userId: mockUser.id,
  /** 分析対象日 */
  date: new Date('2024-01-01'),
  /** プロフィールの閲覧数 */
  profileViews: 100,
  /** 投稿の閲覧数 */
  postViews: 500,
  /** 受け取ったいいね数 */
  likesReceived: 50,
  /** 新規フォロワー数 */
  newFollowers: 10,
  /** 作成日時 */
  createdAt: new Date('2024-01-01'),
  /** 更新日時 */
  updatedAt: new Date('2024-01-01'),
}

/**
 * テスト用ブロックデータ
 *
 * ユーザーのブロック関係を表すモックデータです。
 */
export const mockBlock = {
  /** ブロックレコードの一意識別子 */
  id: 'block-1',
  /** ブロックした側のユーザーID */
  blockerId: mockUser.id,
  /** ブロックされた側のユーザーID */
  blockedId: 'other-user-id',
  /** ブロック日時 */
  createdAt: new Date('2024-01-01'),
  /** ブロックされたユーザーの情報 */
  blocked: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

/**
 * テスト用ミュートデータ
 *
 * ユーザーのミュート関係を表すモックデータです。
 * ミュートすると、相手の投稿がタイムラインに表示されなくなります。
 */
export const mockMute = {
  /** ミュートレコードの一意識別子 */
  id: 'mute-1',
  /** ミュートした側のユーザーID */
  muterId: mockUser.id,
  /** ミュートされた側のユーザーID */
  mutedId: 'other-user-id',
  /** ミュート日時 */
  createdAt: new Date('2024-01-01'),
  /** ミュートされたユーザーの情報 */
  muted: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

/**
 * テスト用フォローデータ
 *
 * ユーザー間のフォロー関係を表すモックデータです。
 */
export const mockFollow = {
  /** フォローレコードの一意識別子 */
  id: 'follow-1',
  /** フォローした側のユーザーID */
  followerId: mockUser.id,
  /** フォローされた側のユーザーID */
  followingId: 'other-user-id',
  /** フォロー日時 */
  createdAt: new Date('2024-01-01'),
  /** フォローされたユーザーの情報 */
  following: {
    id: 'other-user-id',
    nickname: '他のユーザー',
    avatarUrl: '/other-avatar.jpg',
  },
}

/**
 * テスト用いいねデータ
 *
 * 投稿へのいいねを表すモックデータです。
 */
export const mockLike = {
  /** いいねレコードの一意識別子 */
  id: 'like-1',
  /** いいねしたユーザーのID */
  userId: mockUser.id,
  /** いいねされた投稿のID */
  postId: mockPost.id,
  /** いいね日時 */
  createdAt: new Date('2024-01-01'),
}

/**
 * テスト用ブックマークデータ
 *
 * 投稿のブックマークを表すモックデータです。
 */
export const mockBookmark = {
  /** ブックマークレコードの一意識別子 */
  id: 'bookmark-1',
  /** ブックマークしたユーザーのID */
  userId: mockUser.id,
  /** ブックマークされた投稿のID */
  postId: mockPost.id,
  /** ブックマーク日時 */
  createdAt: new Date('2024-01-01'),
}

// ============================================================
// カスタムレンダラー
// ============================================================

/**
 * AllProvidersコンポーネントのprops型
 */
interface AllProvidersProps {
  children: React.ReactNode
}

/**
 * テスト用プロバイダーラッパー
 *
 * Reactコンポーネントをテストする際に必要な
 * 各種プロバイダー（Context）でラップするコンポーネントです。
 *
 * ## ラップされるプロバイダー
 * 1. SessionProvider: 認証セッション情報を提供
 * 2. QueryClientProvider: React Queryのキャッシュを提供
 *
 * ## なぜ必要か
 * 多くのコンポーネントは、これらのプロバイダーから
 * 提供されるコンテキストに依存しています。
 * プロバイダーなしでレンダリングすると、
 * 「No QueryClient set」などのエラーが発生します。
 *
 * @param props - 子コンポーネントを含むprops
 * @returns プロバイダーでラップされた子コンポーネント
 */
function AllProviders({ children }: AllProvidersProps) {
  /**
   * テスト用QueryClientを作成
   *
   * retry: false - テストでは自動リトライを無効化
   *                （失敗を即座に検出するため）
   * gcTime: 0    - ガベージコレクション時間を0に設定
   *                （テスト間でキャッシュが残らないように）
   */
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return (
    <SessionProvider session={mockSession}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  )
}

/**
 * カスタムレンダー関数
 *
 * Testing Libraryのrender関数を拡張し、
 * 自動的にAllProvidersでラップするようにしたものです。
 *
 * @param ui - レンダリングするReact要素
 * @param options - レンダリングオプション（wrapperは上書き不可）
 * @returns Testing Libraryのレンダリング結果
 *
 * @example
 * ```typescript
 * // 通常のレンダリング（自動的にプロバイダーでラップされる）
 * const { getByText } = render(<MyComponent />)
 *
 * // クエリを使って要素を検索
 * expect(getByText('Hello')).toBeInTheDocument()
 * ```
 */
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

// ============================================================
// エクスポート
// ============================================================

/**
 * Testing Libraryのすべての機能を再エクスポート
 *
 * これにより、このファイルからimportするだけで
 * Testing Libraryの全機能が使えるようになります。
 *
 * @example
 * ```typescript
 * import { render, screen, fireEvent, waitFor } from '../utils/test-utils'
 * ```
 */
export * from '@testing-library/react'

/**
 * カスタムレンダー関数を「render」としてエクスポート
 *
 * これにより、通常のrenderの代わりに
 * プロバイダー付きのrenderが使われるようになります。
 */
export { customRender as render }

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * FormDataオブジェクトを作成するヘルパー関数
 *
 * Server Actionsのテストでは、引数としてFormDataを
 * 渡す必要があります。この関数を使うと、
 * オブジェクトから簡単にFormDataを作成できます。
 *
 * @param data - キーと値のペアを持つオブジェクト
 * @returns 作成されたFormDataオブジェクト
 *
 * @example
 * ```typescript
 * // FormDataを作成
 * const formData = createMockFormData({
 *   email: 'test@example.com',
 *   password: 'password123',
 * })
 *
 * // Server Actionに渡す
 * const result = await login(formData)
 * ```
 */
export function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

/**
 * ローディング完了を待機するヘルパー関数
 *
 * 非同期処理を含むコンポーネントのテストで、
 * ローディング状態が解除されるまで待つために使用します。
 *
 * @returns Promiseが解決されるのを待つ
 *
 * @example
 * ```typescript
 * render(<AsyncComponent />)
 *
 * // ローディングが終わるまで待機
 * await waitForLoadingToFinish()
 *
 * // ローディング後のコンテンツを確認
 * expect(screen.getByText('Loaded!')).toBeInTheDocument()
 * ```
 */
export async function waitForLoadingToFinish() {
  // イベントループの次のティックまで待機
  // これにより、Reactの更新が処理される
  await new Promise((resolve) => setTimeout(resolve, 0))
}

// ============================================================
// Prismaモッククライアント
// ============================================================

/**
 * Prismaクライアントのモックを作成する関数
 *
 * ## なぜモックが必要か
 * テストでは実際のデータベースに接続したくありません。
 * - テストが遅くなる
 * - テスト間でデータが干渉する
 * - データベースのセットアップが必要
 *
 * 代わりに、データベース操作を「偽装」するモックを使います。
 * モックは、指定された値を返すだけの偽の関数です。
 *
 * ## 使い方
 * ```typescript
 * // モックを作成
 * const mockPrisma = createMockPrismaClient()
 *
 * // vi.mockでPrismaをモックに置き換え
 * vi.mock('@/lib/db', () => ({
 *   prisma: mockPrisma,
 * }))
 *
 * // テスト内でモックの戻り値を設定
 * mockPrisma.user.findUnique.mockResolvedValue(mockUser)
 *
 * // テスト対象の関数を呼び出す
 * const result = await getUser('test-user-id')
 *
 * // 期待通りの結果が返ることを確認
 * expect(result).toEqual(mockUser)
 * ```
 *
 * @returns 全テーブルのCRUD操作をモック化したオブジェクト
 */
export const createMockPrismaClient = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockClient: any = {
  // ============================================================
  // ユーザー関連テーブル
  // ============================================================

  /**
   * userテーブルのモック
   * ユーザー情報の取得・作成・更新・削除
   */
  user: {
    findUnique: vi.fn(),  // IDやメールで1件検索
    findMany: vi.fn(),    // 条件に合う複数件を検索
    findFirst: vi.fn(),   // 条件に合う最初の1件を検索
    create: vi.fn(),      // 新規作成
    update: vi.fn(),      // 更新
    updateMany: vi.fn(),  // 複数件更新
    delete: vi.fn(),      // 削除
    count: vi.fn(),       // 件数カウント
  },

  // ============================================================
  // 投稿関連テーブル
  // ============================================================

  /**
   * postテーブルのモック
   * 投稿の取得・作成・更新・削除
   */
  post: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },

  /**
   * postMediaテーブルのモック
   * 投稿に添付されたメディア（画像・動画）
   */
  postMedia: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),  // 複数件を一括作成
    delete: vi.fn(),
    deleteMany: vi.fn(),  // 複数件を一括削除
  },

  /**
   * commentテーブルのモック
   * 投稿へのコメント
   */
  comment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },

  commentThreadMute: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  /**
   * likeテーブルのモック
   * 投稿・コメントへのいいね
   */
  like: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },

  // ============================================================
  // フォロー関連テーブル
  // ============================================================

  /**
   * followテーブルのモック
   * ユーザー間のフォロー関係
   */
  follow: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },

  /**
   * bookmarkテーブルのモック
   * 投稿のブックマーク
   */
  bookmark: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },

  /**
   * notificationテーブルのモック
   * ユーザーへの通知
   */
  notification: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },

  // ============================================================
  // ブロック・ミュート関連テーブル
  // ============================================================

  /**
   * blockテーブルのモック
   * ユーザーのブロック
   */
  block: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },

  /**
   * muteテーブルのモック
   * ユーザーのミュート
   */
  mute: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },

  /**
   * followRequestテーブルのモック
   * フォローリクエスト（非公開アカウント向け）
   */
  followRequest: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  // ============================================================
  // ジャンル関連テーブル
  // ============================================================

  /**
   * genreテーブルのモック
   * 盆栽のジャンルマスタ
   */
  genre: {
    findMany: vi.fn(),
  },

  // ============================================================
  // イベント関連テーブル
  // ============================================================

  /**
   * eventテーブルのモック
   * 盆栽展示会などのイベント
   */
  event: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  // ============================================================
  // 盆栽園関連テーブル
  // ============================================================

  /**
   * bonsaiShopテーブルのモック
   * 盆栽園の情報
   */
  bonsaiShop: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  /**
   * shopGenreテーブルのモック
   * 盆栽園の取り扱いジャンル（多対多）
   */
  shopGenre: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },

  /**
   * shopChangeRequestテーブルのモック
   * 盆栽園情報の変更リクエスト
   */
  shopChangeRequest: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  /**
   * shopReviewテーブルのモック
   * 盆栽園へのレビュー
   */
  shopReview: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },

  // ============================================================
  // 通報関連テーブル
  // ============================================================

  /**
   * reportテーブルのモック
   * 不適切コンテンツの通報
   */
  report: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),  // グループ化して集計
  },

  // ============================================================
  // 管理者関連テーブル
  // ============================================================

  /**
   * adminUserテーブルのモック
   * 管理者権限
   */
  adminUser: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },

  /**
   * adminNotificationテーブルのモック
   * 管理者向け通知
   */
  adminNotification: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },

  /**
   * adminLogテーブルのモック
   * 管理者操作ログ
   */
  adminLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },

  /**
   * userSegmentテーブルのモック
   * ユーザーセグメント
   */
  userSegment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  /**
   * userWarningテーブルのモック
   * ユーザーへの警告
   */
  userWarning: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },

  // ============================================================
  // メッセージ関連テーブル
  // ============================================================

  /**
   * conversationテーブルのモック
   * DM会話
   */
  conversation: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },

  /**
   * conversationParticipantテーブルのモック
   * 会話の参加者
   */
  conversationParticipant: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  /**
   * messageテーブルのモック
   * DMメッセージ
   */
  message: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  // ============================================================
  // 下書き・予約投稿関連テーブル
  // ============================================================

  /**
   * draftPostテーブルのモック
   * 投稿の下書き
   */
  draftPost: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  /**
   * draftPostMediaテーブルのモック
   * 下書きに添付されたメディア
   */
  draftPostMedia: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  /**
   * draftPostGenreテーブルのモック
   * 下書きに設定されたジャンル
   */
  draftPostGenre: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  /**
   * scheduledPostテーブルのモック
   * 予約投稿
   */
  scheduledPost: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  /**
   * scheduledPostMediaテーブルのモック
   * 予約投稿に添付されたメディア
   */
  scheduledPostMedia: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  userHiddenPost: {
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  /**
   * scheduledPostGenreテーブルのモック
   * 予約投稿に設定されたジャンル
   */
  scheduledPostGenre: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  // ============================================================
  // 盆栽関連テーブル
  // ============================================================

  /**
   * bonsaiテーブルのモック
   * ユーザーの盆栽
   */
  bonsai: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  /**
   * bonsaiRecordテーブルのモック
   * 盆栽の手入れ記録
   */
  bonsaiRecord: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  bonsaiRecordImage: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },

  /**
   * bonsaiCareLog テーブルのモック。
   * カレンダービュー専用の手入れログ（ユーザー全体メモ）。
   */
  bonsaiCareLog: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  // ============================================================
  // アンケート関連テーブル
  // ============================================================

  poll: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  pollOption: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  pollVote: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },

  // ============================================================
  // ハッシュタグ関連テーブル
  // ============================================================

  /**
   * hashtagテーブルのモック
   * ハッシュタグ
   */
  hashtag: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),  // 存在すれば更新、なければ作成
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },

  /**
   * postHashtagテーブルのモック
   * 投稿とハッシュタグの関連（多対多）
   */
  postHashtag: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn(),
  },

  // ============================================================
  // パスワードリセット関連テーブル
  // ============================================================

  /**
   * passwordResetTokenテーブルのモック
   * パスワードリセットトークン
   */
  passwordResetToken: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  /**
   * emailVerificationTokenテーブルのモック
   * メール確認用トークン（登録後のアドレス確認）
   */
  emailVerificationToken: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  // ============================================================
  // 分析関連テーブル
  // ============================================================

  /**
   * userAnalyticsテーブルのモック
   * ユーザー分析データ
   */
  userAnalytics: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),  // 集計（SUM, AVGなど）
  },

  // ============================================================
  // 投稿ジャンル関連テーブル
  // ============================================================

  /**
   * postGenreテーブルのモック
   * 投稿とジャンルの関連（多対多）
   */
  postGenre: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn(),
  },

  // ============================================================
  // サブスクリプション関連テーブル
  // ============================================================

  /**
   * subscriptionテーブルのモック
   * プレミアム会員のサブスクリプション
   */
  subscription: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },

  /**
   * paymentHistoryテーブルのモック
   * 支払い履歴
   */
  paymentHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
  },

  /**
   * paymentテーブルのモック
   * 支払い情報
   */
  payment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },

  // ============================================================
  // レビュー画像関連テーブル
  // ============================================================

  /**
   * shopReviewImageテーブルのモック
   * 盆栽園レビューに添付された画像
   */
  shopReviewImage: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },

  // ============================================================
  // トランザクション
  // ============================================================

  /**
   * $transactionメソッドのモック
   *
   * トランザクションは、複数のデータベース操作を
   * 「すべて成功」または「すべて失敗」として扱うための機能です。
   *
   * ## 使用例（配列形式）
   * ```typescript
   * await prisma.$transaction([
   *   prisma.user.create({ data: { ... } }),
   *   prisma.post.create({ data: { ... } }),
   * ])
   * ```
   *
   * ## 使用例（コールバック形式）
   * ```typescript
   * await prisma.$transaction(async (tx) => {
   *   const user = await tx.user.create({ data: { ... } })
   *   await tx.post.create({ data: { userId: user.id, ... } })
   * })
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: vi.fn().mockImplementation((callbackOrArray: any) => {
    // 配列形式: 各操作を解決して結果を返す
    if (Array.isArray(callbackOrArray)) {
      return Promise.all(callbackOrArray)
    }
    // コールバック形式: mockPrisma自身をtxとして渡す（テストのモック設定がそのまま使える）
    if (typeof callbackOrArray === 'function') {
      return callbackOrArray(mockClient)
    }
    return Promise.resolve(callbackOrArray)
  }),

  // ============================================================
  // 生のSQL実行
  // ============================================================

  /**
   * $queryRawメソッドのモック
   * 生のSQLクエリを実行（SELECT用）
   */
  $queryRaw: vi.fn(),

  /**
   * $executeRawメソッドのモック
   * 生のSQLを実行（INSERT/UPDATE/DELETE用）
   */
  $executeRaw: vi.fn(),
  }
  return mockClient
}
