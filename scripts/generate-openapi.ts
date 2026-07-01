/**
 * @module scripts/generate-openapi
 *
 * OpenAPI 3.1 ドキュメントをリポジトリルートの openapi/openapi.json に出力する。
 *
 * 使用ライブラリ: @asteasolutions/zod-to-openapi v8（zod v4 対応）
 * バージョン管理: info.version は semver に従い手動更新する。
 *   - パッチ: バグ修正・説明文修正
 *   - マイナー: 後方互換な追加（新フィールド、新エンドポイント）
 *   - メジャー: 破壊的変更（フィールド削除、型変更、エンドポイント廃止）
 *
 * 決定論性: JSON.stringify でキー順を安定させ、再実行で diff ゼロを保証する。
 *
 * extendZodWithOpenApi の適用順:
 *   zod-to-openapi は extendZodWithOpenApi(z) でプロトタイプを拡張してから
 *   スキーマをロードする必要がある。ESM の静的 import は hoist されるため、
 *   スキーマファイルを動的 import することで確実な実行順序を保証する。
 */

import fs from 'fs'
import path from 'path'
import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'
import type { HeadersObject } from 'openapi3-ts/oas31'
import { z } from 'zod'

// CJS 環境で __dirname を使用（tsx はデフォルト CJS）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scriptDir = __dirname

async function main() {
  // extendZodWithOpenApi を静的 import のスキーマより先に実行する必要がある。
  // 動的 import でスキーマをロードすることで実行順序を保証する。
  extendZodWithOpenApi(z)

  const {
    loginRequestSchema,
    verify2FARequestSchema,
    refreshRequestSchema,
    logoutRequestSchema,
    googleRequestSchema,
    passwordResetRequestSchema,
    passwordResetConfirmSchema,
    readPaginationQuerySchema,
    searchQuerySchema,
    searchPostsQuerySchema,
    searchHashtagsQuerySchema,
    SEARCH_POST_MEDIA_TYPE_VALUES,
    registerRequestSchema,
    createReportRequestSchema,
    createPostRequestSchema,
    updatePostRequestSchema,
    createCommentRequestSchema,
    presignedUploadRequestSchema,
    updateProfileRequestSchema,
    registerDeviceRequestSchema,
    createBonsaiRequestSchema,
    updateBonsaiRequestSchema,
    createBonsaiRecordRequestSchema,
    updateBonsaiRecordRequestSchema,
    listEventsQuerySchema,
    createEventRequestSchema,
    updateEventRequestSchema,
    listShopsQuerySchema,
    createShopRequestSchema,
    updateShopRequestSchema,
    createReviewRequestSchema,
    createScheduledPostRequestSchema,
    updateScheduledPostRequestSchema,
    MAX_PENDING_SCHEDULED_POSTS,
    MAX_SCHEDULED_DAYS_AHEAD,
    analyticsSummaryQuerySchema,
    explorePostsQuerySchema,
    createCareLogRequestSchema,
    updateCareLogRequestSchema,
    listCareLogsQuerySchema,
    MAX_CARE_LOG_RANGE_DAYS,
    MAX_BONSAI_CARE_NOTE_LENGTH,
    verifyEmailResendRequestSchema,
    createQuoteRequestSchema,
    pollVoteRequestSchema,
    startConversationRequestSchema,
    sendMessageRequestSchema,
    MAX_MESSAGE_LENGTH,
  } = await import('../lib/api/v1/schemas/request')

  const {
    tokenPairSchema,
    requires2FASchema,
    successSchema,
    usersMeSchema,
    apiErrorResponseSchema,
    mobileApiErrorCodeSchema,
    feedResponseSchema,
    postSchema,
    commentSchema,
    commentsListResponseSchema,
    userProfileSchema,
    searchPostsResponseSchema,
    searchUsersResponseSchema,
    notificationsListResponseSchema,
    unreadCountResponseSchema,
    mentionedUserSchema,
    blockResponseSchema,
    muteResponseSchema,
    userMinimalWithBioSchema,
    userMinimalListResponseSchema,
    postAuthorWithStateSchema,
    presignedUploadResponseSchema,
    imageUploadResponseSchema,
    usersMeFullSchema,
    bookmarkResponseSchema,
    bookmarksListResponseSchema,
    trendingHashtagItemSchema,
    trendingHashtagsResponseSchema,
    trendingGenreItemSchema,
    trendingGenresResponseSchema,
    recommendedUserItemSchema,
    recommendedUsersResponseSchema,
    dictionaryTermSummarySchema,
    dictionaryTermDetailSchema,
    dictionaryListResponseSchema,
    dictionaryDetailResponseSchema,
    dictionaryCategorySchema,
    kanaRowSchema,
    nutrientItemSchema,
    nutrientDetailSchema,
    fertilizerCategoryItemSchema,
    treeSpeciesItemSchema,
    fertilizationMonthSchema,
    fertilizationScheduleResponseSchema,
    nutrientCategorySchema,
    treeCategorySchema,
    fertilizerActionSchema,
    nutrientLevelSchema,
    hormoneItemSchema,
    hormoneEffectSchema,
    hormoneSeasonalLevelSchema,
    hormoneDetailSchema,
    hormoneCategorySchema,
    diseasePestCategorySchema,
    pesticideTypeSchema,
    effectRatingSchema,
    resistanceRiskSchema,
    diseasePestItemSchema,
    diseasePestEffectItemSchema,
    diseasePestDetailSchema,
    diseasePestListResponseSchema,
    pesticideItemSchema,
    pesticideActiveIngredientItemSchema,
    pesticideFormulationTypeSchema,
    pesticideEffectItemSchema,
    pesticideIncompatibilityItemSchema,
    pesticideDetailSchema,
    pesticideListResponseSchema,
    ingredientItemSchema,
    ingredientDetailSchema,
    ingredientListResponseSchema,
    bonsaiListItemSchema,
    bonsaiListResponseSchema,
    bonsaiDetailSchema,
    bonsaiLatestRecordSchema,
    bonsaiRecordItemSchema,
    bonsaiRecordImageSchema,
    bonsaiRecordListResponseSchema,
    eventItemSchema,
    eventListResponseSchema,
    shopItemSchema,
    shopListResponseSchema,
    shopCreatedResponseSchema,
    reviewItemSchema,
    reviewListResponseSchema,
    genreListResponseSchema,
    shopGenreItemSchema,
    scheduledPostStatusSchema,
    scheduledPostMediaItemSchema,
    scheduledPostGenreItemSchema,
    scheduledPostItemSchema,
    scheduledPostListResponseSchema,
    scheduledPostCreatedResponseSchema,
    legalSectionSchema,
    legalDocumentSchema,
    legalListItemSchema,
    legalListResponseSchema,
    analyticsPeriodSchema,
    analyticsTopPostSchema,
    analyticsPostsSummarySchema,
    analyticsDailyEngagementSchema,
    analyticsFollowerGrowthEntrySchema,
    analyticsFollowersSummarySchema,
    analyticsSummaryResponseSchema,
    explorePostsResponseSchema,
    bonsaiCareTypeSchema,
    careLogItemSchema,
    careLogCreatedResponseSchema,
    careLogListResponseSchema,
    followRequestItemSchema,
    followRequestsListResponseSchema,
    notificationPreferencesResponseSchema,
    notificationSettingsResponseSchema,
    userPostsResponseSchema,
    repostResponseSchema,
    postPollOptionSchema,
    postPollVoteRecordSchema,
    postPollSchema,
    pollOptionResponseSchema,
    pollVoteResponseSchema,
    hashtagSearchResponseSchema,
    analyticsDailyCountSchema,
    analyticsPostsResponseSchema,
    analyticsLikesResponseSchema,
    analyticsQuoteItemSchema,
    analyticsQuotesResponseSchema,
    analyticsKeywordItemSchema,
    analyticsKeywordsResponseSchema,
    analyticsEngagementTrendResponseSchema,
    analyticsGenreItemSchema,
    analyticsGenrePerformanceResponseSchema,
    analyticsFollowerGrowthResponseSchema,
    analyticsPeriodMetricSchema,
    analyticsPeriodComparisonResponseSchema,
    dmLastMessageSchema,
    conversationItemSchema,
    conversationListResponseSchema,
    startConversationResponseSchema,
    messageItemSchema,
    messageListResponseSchema,
  } = await import('../lib/api/v1/schemas/response')

  const registry = new OpenAPIRegistry()

  // ──────────────────────────────────────────────────
  // securitySchemes
  // ──────────────────────────────────────────────────

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'アクセストークン（JWT HS256, TTL 15 分）。期限切れ時は /api/v1/auth/refresh でトークンペアを更新する。',
  })

  // ──────────────────────────────────────────────────
  // Zod スキーマを OpenAPI components/schemas に登録
  // ──────────────────────────────────────────────────

  const TokenPair = registry.register(
    'TokenPair',
    tokenPairSchema.openapi({
      description: 'アクセストークン + リフレッシュトークン + 有効期間（秒）のペア。',
    }),
  )

  const Requires2FAResponse = registry.register(
    'Requires2FAResponse',
    requires2FASchema.openapi({
      description: '2FA が必要な場合の 202 レスポンス。ticket を /api/v1/auth/2fa/verify に渡す。',
    }),
  )

  const SuccessResponse = registry.register(
    'SuccessResponse',
    successSchema.openapi({ description: '処理成功を示す汎用レスポンス。' }),
  )

  const UsersMeResponse = registry.register(
    'UsersMeResponse',
    usersMeSchema.openapi({ description: '認証ユーザーの基本情報。' }),
  )

  const UsersMeFullResponse = registry.register(
    'UsersMeFullResponse',
    usersMeFullSchema.openapi({
      description: 'PATCH /api/v1/users/me 成功時の更新後プロフィール全フィールド。',
    }),
  )

  const UpdateProfileRequest = registry.register(
    'UpdateProfileRequest',
    updateProfileRequestSchema.openapi({
      description: [
        'プロフィール部分更新リクエスト。すべてのフィールドが optional。',
        '省略したフィールドは現在値を維持する。',
        'avatarUrl / headerUrl は POST /api/v1/upload/image で取得した自社ストレージ URL を渡すこと（外部 URL は 400 VALIDATION_ERROR）。',
        'nickname は改行・< > を含めない。予約済みは 400 VALIDATION_ERROR。',
      ].join('\n'),
    }),
  )

  const ApiErrorResponse = registry.register(
    'ApiErrorResponse',
    apiErrorResponseSchema.openapi({
      description: '全エンドポイント共通エラーレスポンス形式。',
    }),
  )

  registry.register(
    'MobileApiErrorCode',
    mobileApiErrorCodeSchema.openapi({
      description:
        'エラーコード enum（18 値）。モバイル側はこの enum からコード→メッセージ対応表を導出できる。',
    }),
  )

  const LoginRequest = registry.register(
    'LoginRequest',
    loginRequestSchema.openapi({ description: 'メール/パスワード認証のリクエスト。' }),
  )

  const Verify2FARequest = registry.register(
    'Verify2FARequest',
    verify2FARequestSchema.openapi({
      description: '2FA コード検証のリクエスト。',
    }),
  )

  const RefreshRequest = registry.register(
    'RefreshRequest',
    refreshRequestSchema.openapi({ description: 'トークンリフレッシュのリクエスト。' }),
  )

  const LogoutRequest = registry.register(
    'LogoutRequest',
    logoutRequestSchema.openapi({ description: 'ログアウトのリクエスト。' }),
  )

  const GoogleRequest = registry.register(
    'GoogleRequest',
    googleRequestSchema.openapi({ description: 'Google ID トークン認証のリクエスト。' }),
  )

  const PasswordResetRequest = registry.register(
    'PasswordResetRequest',
    passwordResetRequestSchema.openapi({
      description: 'パスワードリセットメール送信のリクエスト。',
    }),
  )

  const VerifyEmailResendRequest = registry.register(
    'VerifyEmailResendRequest',
    verifyEmailResendRequestSchema.openapi({
      description: '確認メール再送のリクエスト。メールアドレスの存在有無に関わらず常に 200 を返す（列挙攻撃対策）。',
    }),
  )

  const PasswordResetConfirm = registry.register(
    'PasswordResetConfirm',
    passwordResetConfirmSchema.openapi({ description: 'パスワードリセット確定のリクエスト。' }),
  )

  const RegisterRequest = registry.register(
    'RegisterRequest',
    registerRequestSchema.openapi({
      description: '新規ユーザー登録のリクエスト。termsAccepted は true のみ受け付ける（利用規約同意の強制）。',
    }),
  )

  registry.register(
    'ReadPaginationQuery',
    readPaginationQuerySchema.openapi({
      description: 'カーソルベースページネーションのクエリパラメータ（cursor, limit）。',
    }),
  )

  registry.register(
    'SearchQuery',
    searchQuerySchema.openapi({
      description: '検索クエリパラメータ（q, cursor, limit）。',
    }),
  )

  registry.register(
    'SearchPostsQuery',
    searchPostsQuerySchema.openapi({
      description: [
        '投稿検索クエリパラメータ。SearchQuery を拡張して投稿専用フィルタを追加。',
        `mediaType は ${SEARCH_POST_MEDIA_TYPE_VALUES.join(' / ')} のいずれか（image=画像あり / video=動画あり / none=テキストのみ）。`,
      ].join('\n'),
    }),
  )

  registry.register(
    'SearchHashtagsQuery',
    searchHashtagsQuerySchema.openapi({
      description: 'ハッシュタグ候補検索クエリパラメータ（q, limit）。オートコンプリート用。',
    }),
  )

  const HashtagSearchResponse = registry.register(
    'HashtagSearchResponse',
    hashtagSearchResponseSchema.openapi({
      description: 'ハッシュタグ候補検索結果（id, name, count）。count 降順。',
    }),
  )

  // ──────────────────────────────────────────────────
  // 書き込み系エンドポイントのスキーマ
  // ──────────────────────────────────────────────────

  const BlockResponse = registry.register(
    'BlockResponse',
    blockResponseSchema.openapi({
      description: 'ブロック操作後の状態。POST→true / DELETE→false。冪等: 既ブロック/未ブロックでも 200。',
    }),
  )

  const MuteResponse = registry.register(
    'MuteResponse',
    muteResponseSchema.openapi({
      description: 'ミュート操作後の状態。POST→true / DELETE→false。冪等: 既ミュート/未ミュートでも 200。',
    }),
  )

  registry.register(
    'UserMinimalWithBio',
    userMinimalWithBioSchema.openapi({
      description: 'ブロック/ミュート一覧のユーザー項目（id, nickname, avatarUrl, bio）。',
    }),
  )

  const UserMinimalListResponse = registry.register(
    'UserMinimalListResponse',
    userMinimalListResponseSchema.openapi({
      description: 'ブロック/ミュート一覧レスポンス。カーソルページネーション形式。',
    }),
  )

  const CreateReportRequest = registry.register(
    'CreateReportRequest',
    createReportRequestSchema.openapi({
      description: '通報リクエスト。targetType と reason は enum 値のみ受け付ける。',
    }),
  )

  const LikeResponse = registry.register(
    'LikeResponse',
    z.object({
      liked: z.boolean(),
      likeCount: z.number().int(),
    }).openapi({
      description: 'いいね操作後の最新状態。liked は操作後の状態、likeCount は操作後の総いいね数。',
    }),
  )

  const FollowResponse = registry.register(
    'FollowResponse',
    z.object({
      following: z.boolean(),
      requested: z.boolean(),
      followerCount: z.number().int(),
    }).openapi({
      description: 'フォロー操作後の統一レスポンス。following/requested は同時に true にならない。followerCount は操作後の実数。',
    }),
  )

  const NotificationReadRequest = registry.register(
    'NotificationReadRequest',
    z.object({
      ids: z.array(z.string()).optional(),
    }).openapi({
      description: '既読化する通知 ID の配列。省略または空配列の場合は全未読を既読化する。最大 100 件。',
    }),
  )

  // ──────────────────────────────────────────────────
  // Batch 2c — 投稿 CRUD + コメント作成/削除スキーマ登録
  // ──────────────────────────────────────────────────

  const CreatePostRequest = registry.register(
    'CreatePostRequest',
    createPostRequestSchema.openapi({
      description: [
        '投稿作成リクエスト。content / mediaUrls のどちらか一方は必須。',
        'genreIds は最大 3 つ。mediaUrls と mediaTypes は同数で対応させること。',
        'poll を指定するとアンケート付き投稿になる。',
      ].join('\n'),
    }),
  )

  const CreateQuoteRequest = registry.register(
    'CreateQuoteRequest',
    createQuoteRequestSchema.openapi({
      description: [
        '引用投稿リクエスト（POST /api/v1/posts/{id}/quote）。',
        'content は必須（空文字は 400）。',
        'genreIds は最大 3 つ。',
      ].join('\n'),
    }),
  )

  const PollVoteRequest = registry.register(
    'PollVoteRequest',
    pollVoteRequestSchema.openapi({
      description: 'アンケート投票リクエスト。optionId は投票する選択肢の ID。',
    }),
  )

  const UserPostsResponse = registry.register(
    'UserPostsResponse',
    userPostsResponseSchema.openapi({
      description: 'ユーザー投稿一覧レスポンス。カーソルページネーション形式。',
    }),
  )

  const RepostResponse = registry.register(
    'RepostResponse',
    repostResponseSchema.openapi({
      description: 'リポスト操作後の状態。reposted は操作後の状態、repostCount は最新の総リポスト数。',
    }),
  )

  registry.register(
    'PostPollOption',
    postPollOptionSchema.openapi({
      description: [
        'PostResponse に埋め込まれるアンケート選択肢。Prisma 生形をそのまま JSON 化したもの。',
        'voteCount は _count.votes で取得する。',
      ].join('\n'),
    }),
  )

  registry.register(
    'PostPollVoteRecord',
    postPollVoteRecordSchema.openapi({
      description: '認証ユーザーの投票履歴レコード（PostResponse.poll.votes の 1 件）。ゲストには含まれない。',
    }),
  )

  registry.register(
    'PostPoll',
    postPollSchema.openapi({
      description: [
        'PostResponse に埋め込まれるアンケートの実形（Prisma 生形 JSON）。',
        'totalVotes は _count.votes で取得する。閲覧者の投票状態は votes[0].optionId で判定する。',
        'votes フィールドはゲストには含まれない。未投票なら空配列。',
        'PollVoteResponse（POST /polls/{id}/vote の応答）とは別形状。',
      ].join('\n'),
    }),
  )

  registry.register(
    'PollOptionResponse',
    pollOptionResponseSchema.openapi({
      description: 'アンケート選択肢（投票後）。percentage は全票に占める割合（0〜100, 小数第 1 位）。',
    }),
  )

  const PollVoteResponse = registry.register(
    'PollVoteResponse',
    pollVoteResponseSchema.openapi({
      description: 'アンケート投票後の最新集計結果。',
    }),
  )

  const UpdatePostRequest = registry.register(
    'UpdatePostRequest',
    updatePostRequestSchema.openapi({
      description: [
        '投稿編集リクエスト（所有者のみ）。ジャンル・メディアは差し替え方式。',
        '純粋リポストは編集不可（400 VALIDATION_ERROR）。',
        '1 日投稿上限は消費しない。editedAt が更新される。',
      ].join('\n'),
    }),
  )

  const CreateCommentRequest = registry.register(
    'CreateCommentRequest',
    createCommentRequestSchema.openapi({
      description: [
        'コメント作成リクエスト。content / mediaUrls のどちらか一方は必須。',
        'parentId を指定すると返信コメントになる（スレッド参加者全員へ reply 通知）。',
        '本文最大 500 文字。画像最大 2 枚。動画はプレミアム会員のみ 1 本。',
      ].join('\n'),
    }),
  )

  const CommentResponse = registry.register(
    'CommentResponse',
    commentSchema.openapi({ description: '単一コメントのレスポンス（作成時に返却）。' }),
  )

  const NotificationReadResponse = registry.register(
    'NotificationReadResponse',
    z.object({
      success: z.literal(true),
      unreadCount: z.number().int(),
    }).openapi({
      description: '通知既読化後のレスポンス。unreadCount はミュートユーザーを除いた操作後の未読数。',
    }),
  )

  registry.register(
    'MentionedUser',
    mentionedUserSchema.openapi({
      description: 'メンション解決済みユーザー情報。content 内の `<@userId>` トークンに対応する表示情報。',
    }),
  )

  registry.register(
    'PostAuthorWithState',
    postAuthorWithStateSchema.openapi({
      description:
        'トップレベル投稿者・コメント投稿者の情報（閲覧者視点の Block/Mute 状態付き）。' +
        'quotePost / repostPost のネスト著者には適用されない。' +
        'isBlocked/isMuted はゲスト・未ブロック・未ミュートの場合は false。',
    }),
  )

  const FeedResponse = registry.register(
    'FeedResponse',
    feedResponseSchema.openapi({ description: 'タイムライン取得レスポンス。各投稿に mentionedUsers が含まれる。' }),
  )

  const PostResponse = registry.register(
    'PostResponse',
    postSchema.openapi({ description: '単一投稿の詳細レスポンス。mentionedUsers が含まれる。' }),
  )

  const CommentsListResponse = registry.register(
    'CommentsListResponse',
    commentsListResponseSchema.openapi({ description: 'コメント一覧取得レスポンス。' }),
  )

  const UserProfileResponse = registry.register(
    'UserProfileResponse',
    userProfileSchema.openapi({ description: 'ユーザープロフィール取得レスポンス。' }),
  )

  const SearchPostsResponse = registry.register(
    'SearchPostsResponse',
    searchPostsResponseSchema.openapi({ description: '投稿検索結果レスポンス。' }),
  )

  const SearchUsersResponse = registry.register(
    'SearchUsersResponse',
    searchUsersResponseSchema.openapi({ description: 'ユーザー検索結果レスポンス。' }),
  )

  const NotificationsListResponse = registry.register(
    'NotificationsListResponse',
    notificationsListResponseSchema.openapi({ description: '通知一覧取得レスポンス。' }),
  )

  const UnreadCountResponse = registry.register(
    'UnreadCountResponse',
    unreadCountResponseSchema.openapi({ description: '未読通知件数レスポンス。' }),
  )

  // ──────────────────────────────────────────────────
  // Batch 3a — ブックマーク + 発見/explore スキーマ登録
  // ──────────────────────────────────────────────────

  const BookmarkResponse = registry.register(
    'BookmarkResponse',
    bookmarkResponseSchema.openapi({
      description: 'ブックマーク操作後の状態。POST→true / DELETE→false。冪等: 既ブックマーク/未ブックマークでも 200。',
    }),
  )

  const BookmarksListResponse = registry.register(
    'BookmarksListResponse',
    bookmarksListResponseSchema.openapi({
      description: 'ブックマーク投稿一覧レスポンス。feed と同等の投稿形式（mentionedUsers / isBlocked / isMuted 付き）。',
    }),
  )

  registry.register(
    'TrendingHashtagItem',
    trendingHashtagItemSchema.openapi({
      description: 'トレンドハッシュタグ 1 件（id, name, count）。count は Hashtag テーブルの累計投稿数。',
    }),
  )

  const TrendingHashtagsResponse = registry.register(
    'TrendingHashtagsResponse',
    trendingHashtagsResponseSchema.openapi({ description: 'トレンドハッシュタグ一覧レスポンス。count 降順。' }),
  )

  registry.register(
    'TrendingGenreItem',
    trendingGenreItemSchema.openapi({
      description: 'トレンドジャンル 1 件（id, name, category, postCount）。postCount は直近 48 時間の投稿数。',
    }),
  )

  const TrendingGenresResponse = registry.register(
    'TrendingGenresResponse',
    trendingGenresResponseSchema.openapi({ description: 'トレンドジャンル一覧レスポンス。postCount 降順。' }),
  )

  registry.register(
    'RecommendedUserItem',
    recommendedUserItemSchema.openapi({
      description: 'おすすめユーザー 1 件（id, nickname, avatarUrl, bio, followersCount, following, requested, isPublic）。ゲスト時は空配列。',
    }),
  )

  const RecommendedUsersResponse = registry.register(
    'RecommendedUsersResponse',
    recommendedUsersResponseSchema.openapi({ description: 'おすすめユーザー一覧レスポンス。フォロワー数降順。ゲスト時は空配列。' }),
  )

  // ──────────────────────────────────────────────────
  // 共通エラーレスポンス定義ヘルパー
  // ──────────────────────────────────────────────────

  function errorResponse(description: string) {
    return {
      description,
      content: {
        'application/json': {
          schema: ApiErrorResponse,
        },
      },
    }
  }

  // HeadersObject 型を明示することで openapi3-ts の index signature と互換させる
  const retryAfterHeaders: HeadersObject = {
    'Retry-After': {
      description: '次のリクエストまでの待機秒数',
      schema: { type: 'integer' },
    },
  }

  const rateLimitedResponse = {
    description: 'レート制限超過。Retry-After ヘッダー（秒）が返却される。自動リトライ禁止。',
    headers: retryAfterHeaders,
    content: {
      'application/json': {
        schema: ApiErrorResponse,
      },
    },
  }

  // ──────────────────────────────────────────────────
  // パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['auth'],
    summary: 'メール/パスワードでログイン',
    description: [
      'パスワード照合後、2FA の有効/無効によってレスポンスが分岐する。',
      '',
      '- 2FA 無効: 200 + TokenPair',
      '- 2FA 有効: 202 + { requires2FA: true, ticket } — ticket は /api/v1/auth/2fa/verify に渡す',
      '  - チケット TTL: 300 秒（5 分）、単回使用（成功・失敗いずれの場合も消費）',
      '  - コード不正時もチケットが消費されるため /login からやり直すこと',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: LoginRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'ログイン成功（2FA 無効）',
        content: { 'application/json': { schema: TokenPair } },
      },
      202: {
        description: '2FA が必要。ticket を /api/v1/auth/2fa/verify に渡す',
        content: { 'application/json': { schema: Requires2FAResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('資格情報が不正 (AUTH_INVALID_CREDENTIALS)'),
      403: errorResponse(
        'アカウント停止 (ACCOUNT_SUSPENDED) またはゲストアカウント不可 (GUEST_NOT_ALLOWED)',
      ),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/2fa/verify',
    tags: ['auth'],
    summary: '2FA コードを検証してトークンペアを取得',
    description: [
      '/api/v1/auth/login の 202 で返却された ticket と TOTP コード（またはバックアップコード）を検証する。',
      '',
      '重要仕様:',
      '- チケットは成功・失敗いずれの場合も GETDEL でアトミックに消費される（単回使用）',
      '- コード不正の場合もチケットは消費済みになるため /api/v1/auth/login からやり直すこと',
      '- チケット TTL は 300 秒（5 分）',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: Verify2FARequest },
        },
      },
    },
    responses: {
      200: {
        description: '2FA 検証成功。TokenPair を返却',
        content: { 'application/json': { schema: TokenPair } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse(
        'チケット期限切れ (AUTH_2FA_TICKET_EXPIRED) または コード不正 (AUTH_2FA_INVALID_CODE)',
      ),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/refresh',
    tags: ['auth'],
    summary: 'リフレッシュトークンでトークンペアを更新',
    description: [
      'ローテーション + 再利用検知方式:',
      '- 有効トークン提示 → 旧トークンを revoke し新ペアを発行（トランザクション）',
      '- revoked 済みトークン再提示 → 盗難とみなし当該ユーザーの全トークンを即時失効 (AUTH_REFRESH_TOKEN_REUSE_DETECTED)',
      '  - モバイルはこのコードで専用の「セキュリティ警告」画面を表示すること',
      '',
      'リフレッシュトークン TTL は 30 日。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: RefreshRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'トークン更新成功。新しい TokenPair を返却',
        content: { 'application/json': { schema: TokenPair } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse(
        'トークン無効/期限切れ (AUTH_REFRESH_TOKEN_INVALID) または 再利用検知 (AUTH_REFRESH_TOKEN_REUSE_DETECTED)',
      ),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    tags: ['auth'],
    summary: 'ログアウト（リフレッシュトークン失効）',
    description: [
      '冪等設計: トークンが存在しない・既に失効済みでも 200 を返す。',
      'ネットワークエラー時のリトライを妨げない fail-safe ログアウトを実現する。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: LogoutRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'ログアウト成功（冪等）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/google',
    tags: ['auth'],
    summary: 'Google ID トークンでログイン',
    description: [
      'Google Sign-In で取得した ID トークンを検証し、TokenPair を発行する。',
      '',
      'ユーザー解決フロー:',
      "1. Account(provider='google', providerAccountId=sub) を検索",
      '2. なければ email で User を検索し Account を作成してリンク',
      '3. User も存在しなければ新規作成',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: GoogleRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'Google 認証成功。TokenPair を返却',
        content: { 'application/json': { schema: TokenPair } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('ID トークン不正 (AUTH_INVALID_TOKEN)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/password-reset/request',
    tags: ['auth'],
    summary: 'パスワードリセットメールを送信',
    description: [
      '列挙攻撃対策: メールアドレスの存在有無に関わらず常に 200 を返す。',
      'バリデーションエラーも 200 を返す（この仕様は意図的）。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: PasswordResetRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'リクエスト受付（メールアドレス存在有無に関わらず常に 200）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/password-reset/confirm',
    tags: ['auth'],
    summary: 'パスワードリセットを確定',
    description: [
      'メールで受け取ったトークンと新しいパスワードを送信してリセットを確定する。',
      'トークン無効・ユーザー不在は一律 401 を返す（列挙攻撃防止）。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: PasswordResetConfirm },
        },
      },
    },
    responses: {
      200: {
        description: 'パスワードリセット成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('トークン無効または資格情報不正 (AUTH_INVALID_CREDENTIALS)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    tags: ['auth'],
    summary: '新規ユーザー登録',
    description: [
      'ニックネーム・メールアドレス・パスワードで新規ユーザーを作成し、確認メールを送信する。',
      '',
      'フロー:',
      '1. バリデーション通過後、レート制限チェック（IP ベース）',
      '2. ユーザー作成 + メール確認トークン発行',
      '3. 確認メール送信（リンク有効期間: 24 時間）',
      '4. 201 { success: true } を返す',
      '',
      'モバイルはこのレスポンスを受け取ったら verify-email-sent 画面へ遷移し、',
      'ユーザーに確認メールのリンクをクリックするよう促す。',
      '',
      '列挙攻撃方針: Web の登録フォームはメール重複を明示的にユーザーに返すため、',
      'API も一貫して 409 CONFLICT で同じ情報量を返す（片方だけ隠すと一貫性が失われる）。',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: RegisterRequest },
        },
      },
    },
    responses: {
      201: {
        description: '登録成功。確認メールを送信済み。モバイルは verify-email-sent 画面へ遷移すること',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — nickname/email/password の形式不正または termsAccepted が true でない'),
      409: errorResponse('メールアドレス重複 (CONFLICT)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー — 確認メール送信失敗など (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me',
    tags: ['users'],
    summary: '認証ユーザーの基本情報を取得',
    description: [
      'Authorization: Bearer <accessToken> ヘッダーで認証する。',
      '',
      'エラーフロー:',
      '- Bearer ヘッダー無し → 401 AUTH_REQUIRED',
      '- トークン期限切れ → 401 AUTH_TOKEN_EXPIRED（このコードでのみ /refresh を試みること）',
      '- トークン不正 → 401 AUTH_INVALID_TOKEN（リフレッシュ不可）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '認証ユーザーの基本情報',
        content: { 'application/json': { schema: UsersMeResponse } },
      },
      401: errorResponse(
        'Bearer トークンなし (AUTH_REQUIRED)、期限切れ (AUTH_TOKEN_EXPIRED)、不正 (AUTH_INVALID_TOKEN)',
      ),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('ユーザーが見つからない (NOT_FOUND)'),
      503: errorResponse('サーバー設定エラー (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/users/me',
    tags: ['users'],
    summary: '認証ユーザーのプロフィールを部分更新',
    description: [
      '自分のプロフィールを部分更新する。省略したフィールドは現在値を維持する。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- avatarUrl / headerUrl は POST /api/v1/upload/image で取得した自社ストレージ URL を渡すこと',
      '  外部 URL は 400 VALIDATION_ERROR で拒否される（IP 漏洩・不正コンテンツ配信の防止）',
      '- nickname は改行・< > を含めない（バリデーション不通過で 400 VALIDATION_ERROR）',
      '- 予約済み nickname は 400 VALIDATION_ERROR',
      '- 成功レスポンス: 200 + 更新後の全プロフィールフィールド（楽観更新に使用可）',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: UpdateProfileRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'プロフィール更新成功。更新後の全フィールドを返す',
        content: { 'application/json': { schema: UsersMeFullResponse } },
      },
      400: errorResponse(
        'バリデーションエラー (VALIDATION_ERROR) — nickname 形式不正 / 予約済み / avatarUrl|headerUrl が自社ストレージ外',
      ),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/users/me',
    tags: ['users'],
    summary: '認証ユーザーのアカウントを削除（不可逆）',
    description: [
      '自分のアカウントとすべての関連データを完全削除する。この操作は不可逆。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 削除されるデータ: ユーザー情報・投稿・コメント・フォロー・いいね・通知・メッセージ・リフレッシュトークン等（Cascade）',
      '- リフレッシュトークンは Cascade 削除により即時失効する',
      '  （アカウント削除後のトークンリフレッシュは 401 AUTH_INVALID_TOKEN で拒否される）',
      '- パスワード再確認は不要（Bearer トークンのみで操作を認可する。Web と同等の認可レベル）',
      '- Google Play ストアのデータ削除要件（DDA）に対応するエンドポイント',
      '- レート制限: engagement（30/分）',
      '- 成功レスポンス: 200 { success: true }',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'アカウント削除成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー — 削除処理失敗 (INTERNAL_ERROR)'),
    },
  })

  // ──────────────────────────────────────────────────
  // 読み取り系エンドポイント
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/feed',
    tags: ['feed'],
    summary: 'タイムライン取得',
    description: [
      '認証ユーザーのタイムライン（フォロー中ユーザーの投稿）をカーソルページネーションで返す。',
      '',
      'ゲストユーザーの場合は公開投稿の直近 N 件のみ返し nextCursor は null になる。',
      '',
      'ブロック・ミュート・停止済み著者の投稿は除外される。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: 'タイムライン取得成功',
        content: { 'application/json': { schema: FeedResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/posts/{id}',
    tags: ['posts'],
    summary: '投稿詳細取得',
    description: [
      '指定 ID の投稿を取得する。',
      '',
      '非公開アカウントの投稿はフォロワーのみ閲覧可能。',
      'ブロックされている場合は 404 を返す。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: '投稿詳細',
        content: { 'application/json': { schema: PostResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/posts/{id}/comments',
    tags: ['posts'],
    summary: 'コメント一覧取得',
    description: [
      '指定投稿のトップレベルコメント一覧をカーソルページネーションで返す。',
      '',
      'ブロック済みユーザーのコメントは isBlockedUser: true として含まれる（非表示はクライアント側で判断）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: 'コメント一覧',
        content: { 'application/json': { schema: CommentsListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/{id}',
    tags: ['users'],
    summary: 'ユーザープロフィール取得',
    description: [
      '指定 ID のユーザープロフィールを返す。',
      '',
      'メールアドレスは返却しない。',
      '非公開アカウントはフォロワー以外には公開情報のみ返す（フォロワー数等は含む）。',
      'ゲストアカウントは 404 として扱う。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'ユーザー ID' }) }),
    },
    responses: {
      200: {
        description: 'ユーザープロフィール',
        content: { 'application/json': { schema: UserProfileResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('ユーザーが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/{id}/posts',
    tags: ['users'],
    summary: 'ユーザーの投稿一覧を取得（カーソルページネーション）',
    description: [
      '指定ユーザーの投稿をカーソルページネーションで返す。',
      '',
      '重要仕様:',
      '- 非公開アカウントはフォロワー以外には 403 FORBIDDEN を返す',
      '- ゲストアクセス可: 公開アカウントの投稿を閲覧できる',
      '- 自分自身の投稿: 非公開投稿も含む',
      '- ブロック・ミュート・停止ユーザーへのアクセスは 404 NOT_FOUND',
      '- レート制限: timeline（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'ユーザー ID' }) }),
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: 'ユーザー投稿一覧',
        content: { 'application/json': { schema: UserPostsResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) または非公開アカウントへのアクセス (NOT_FOUND)'),
      404: errorResponse('ユーザーが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/search/posts',
    tags: ['search'],
    summary: '投稿検索',
    description: [
      'キーワードで投稿を全文検索する。',
      '',
      '2 文字以上: pg_bigm trigram 検索。1 文字: LIKE フォールバック。',
      'ブロック・ミュート・非公開・停止ユーザーの投稿は除外される。',
      '',
      'フィルタ:',
      `- mediaType: ${SEARCH_POST_MEDIA_TYPE_VALUES.join(' / ')}（image=画像あり / video=動画あり / none=テキストのみ）`,
      '- dateFrom / dateTo: ISO8601 日付（YYYY-MM-DD）での期間絞り込み',
      '- minLikes: 最低いいね数でフィルタ',
      '- genreId: ジャンル ID で絞り込み',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional().openapi({ description: '検索キーワード' }),
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
        genreId: z.string().optional().openapi({ description: 'ジャンル ID でフィルタ' }),
        dateFrom: z.string().optional().openapi({ description: '投稿日時の開始日（ISO8601 YYYY-MM-DD）' }),
        dateTo: z.string().optional().openapi({ description: '投稿日時の終了日（ISO8601 YYYY-MM-DD）' }),
        minLikes: z.number().int().min(0).optional().openapi({ description: '最低いいね数' }),
        mediaType: z.enum(SEARCH_POST_MEDIA_TYPE_VALUES).optional().openapi({
          description: `メディア種別フィルタ: ${SEARCH_POST_MEDIA_TYPE_VALUES.join(' / ')}`,
        }),
      }),
    },
    responses: {
      200: {
        description: '投稿検索結果',
        content: { 'application/json': { schema: SearchPostsResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/search/users',
    tags: ['search'],
    summary: 'ユーザー検索',
    description: [
      'ニックネームでユーザーを検索する。',
      '',
      'ブロック・ミュート・停止済みユーザーは除外される。',
      'ゲストアカウントは結果に含まれない。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional().openapi({ description: '検索キーワード' }),
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: 'ユーザー検索結果',
        content: { 'application/json': { schema: SearchUsersResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/search/hashtags',
    tags: ['search'],
    summary: 'ハッシュタグ候補検索（オートコンプリート）',
    description: [
      'ハッシュタグ名の部分一致で候補を検索する。count 降順で返す。',
      '',
      '重要仕様:',
      '- count=0 のハッシュタグは除外される',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: search（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        q: z.string().optional().openapi({ description: '検索キーワード（空文字は人気順で返す）' }),
        limit: z.number().int().min(1).max(50).optional().openapi({ description: '取得件数（デフォルト 10、最大 50）' }),
      }),
    },
    responses: {
      200: {
        description: 'ハッシュタグ候補検索成功',
        content: { 'application/json': { schema: HashtagSearchResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/notifications',
    tags: ['notifications'],
    summary: '通知一覧取得',
    description: [
      '認証ユーザーの通知をカーソルページネーションで返す。',
      '',
      'ゲストユーザーは利用不可（403 GUEST_NOT_ALLOWED）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル' }),
        limit: z.number().int().optional().openapi({ description: '取得上限件数' }),
      }),
    },
    responses: {
      200: {
        description: '通知一覧',
        content: { 'application/json': { schema: NotificationsListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse(
        'アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)',
      ),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // 書き込み系エンドポイント
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/v1/posts/{id}/like',
    tags: ['posts'],
    summary: '投稿にいいねを付ける（冪等）',
    description: [
      '対象投稿にいいねを付与する。既にいいね済みでも 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- 不存在・非公開・非表示の投稿は 404 NOT_FOUND を返す',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- likeCount は操作後の最新値（楽観更新の確定値として使用できる）',
      '- 通知（like）は同一ユーザーへの重複通知を防ぐ重複排除が働く',
      '- レート制限: toggle_like（30/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'いいね付与成功（既にいいね済みでも 200）',
        content: { 'application/json': { schema: LikeResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/posts/{id}/like',
    tags: ['posts'],
    summary: '投稿のいいねを解除する（冪等）',
    description: [
      '対象投稿のいいねを解除する。いいねしていなくても 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- 不存在・非公開・非表示の投稿は 404 NOT_FOUND を返す',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- likeCount は操作後の最新値',
      '- レート制限: toggle_like（30/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'いいね解除成功（いいねしていなくても 200）',
        content: { 'application/json': { schema: LikeResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/posts/{id}/repost',
    tags: ['posts'],
    summary: '投稿をリポストする（冪等）',
    description: [
      '対象投稿をリポストする。既にリポスト済みでも 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- 自己リポストは 400 VALIDATION_ERROR',
      '- 不存在・非公開・非表示の投稿は 404 NOT_FOUND',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- repostCount は操作後の最新値（楽観更新の確定値として使用できる）',
      '- 通知（repost）は相手に送信される（自己の場合は送信しない）',
      '- レート制限: engagement（30/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'リポスト成功（既にリポスト済みでも 200）',
        content: { 'application/json': { schema: RepostResponse } },
      },
      400: errorResponse('自己リポスト (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/posts/{id}/repost',
    tags: ['posts'],
    summary: '投稿のリポストを解除する（冪等）',
    description: [
      '対象投稿のリポストを解除する。リポストしていなくても 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- 不存在の投稿は 404 NOT_FOUND',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- repostCount は操作後の最新値',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'リポスト解除成功（リポストしていなくても 200）',
        content: { 'application/json': { schema: RepostResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/posts/{id}/quote',
    tags: ['posts'],
    summary: '引用投稿を作成する（201）',
    description: [
      '指定投稿を引用した新規投稿を作成する。',
      '',
      '重要仕様:',
      '- content は必須（空文字は 400 VALIDATION_ERROR）',
      '- 引用元が存在しない・閲覧不可の場合は 404 NOT_FOUND',
      '- 1日投稿上限に達した場合は 429 RATE_LIMITED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 成功時は 201 Created と新規投稿の PostResponse を返す',
      '- レート制限: post（3/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '引用元の投稿 ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: CreateQuoteRequest },
        },
      },
    },
    responses: {
      201: {
        description: '引用投稿作成成功。新規投稿の詳細を返す',
        content: { 'application/json': { schema: PostResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — content 空・メディア超過等'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('引用元投稿が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/users/{id}/follow',
    tags: ['users'],
    summary: 'ユーザーをフォロー（公開: フォロー確立 / 非公開: リクエスト送信）',
    description: [
      '対象ユーザーの公開設定に応じてフォローまたはフォローリクエストを送信する。',
      '',
      '重要仕様:',
      '- 公開アカウント → フォロー確立（冪等: 既にフォロー済みでも 200）→ { following:true, requested:false }',
      '- 非公開アカウント → フォローリクエスト送信（冪等: 既に送信済みでも 200）→ { following:false, requested:true }',
      '- HTTP は 200 に統一（202 は使用しない）',
      '- 自分自身へのフォローは 400 VALIDATION_ERROR',
      '- ブロック関係・存在しない・停止済みユーザーは 404 NOT_FOUND（ブロック有無を秘匿）',
      '- followerCount は操作後の実数',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'フォロー対象ユーザー ID' }) }),
    },
    responses: {
      200: {
        description: 'フォロー確立またはリクエスト送信成功',
        content: { 'application/json': { schema: FollowResponse } },
      },
      400: errorResponse('自己フォロー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('ユーザーが存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/users/{id}/follow',
    tags: ['users'],
    summary: 'フォロー解除またはフォローリクエスト取消（同一エンドポイント、冪等）',
    description: [
      'フォロー中の場合はフォロー解除、リクエスト中の場合はリクエスト取消を行う。',
      'どちらでもない場合は no-op として { following:false, requested:false } を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- フォロー中 → フォロー解除',
      '- リクエスト中 → リクエスト取消',
      '- どちらでもない → no-op（200）',
      '- 全ケースで { following:false, requested:false, followerCount } を返す',
      '- followerCount は操作後の実数',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'フォロー対象ユーザー ID' }) }),
    },
    responses: {
      200: {
        description: 'フォロー解除またはリクエスト取消成功（どちらでもない場合も 200）',
        content: { 'application/json': { schema: FollowResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/users/{id}/block',
    tags: ['users'],
    summary: 'ユーザーをブロック（冪等）',
    description: [
      '対象ユーザーをブロックする。既にブロック済みでも 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- ブロック時に相互フォロー（両方向）をトランザクション内で解除する',
      '- ブロック解除後にフォロー関係は復活しない（再フォローは別途操作が必要）',
      '- 自己ブロックは 400 VALIDATION_ERROR',
      '- 対象不在・停止ユーザーは 404 NOT_FOUND',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: block_user（10/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'ブロック対象ユーザー ID（cuid）' }) }),
    },
    responses: {
      200: {
        description: 'ブロック成功（既ブロックでも 200）',
        content: { 'application/json': { schema: BlockResponse } },
      },
      400: errorResponse('自己ブロック (VALIDATION_ERROR) または不正 ID (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('対象ユーザーが存在しないか停止済み (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/users/{id}/block',
    tags: ['users'],
    summary: 'ブロック解除（冪等）',
    description: [
      '対象ユーザーのブロックを解除する。ブロックしていなくても 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- ブロック解除後にフォロー関係は復活しない',
      '- 自己操作は 400 VALIDATION_ERROR',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: unblock_user（10/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'ブロック解除対象ユーザー ID（cuid）' }) }),
    },
    responses: {
      200: {
        description: 'ブロック解除成功（未ブロックでも 200）',
        content: { 'application/json': { schema: BlockResponse } },
      },
      400: errorResponse('自己操作 (VALIDATION_ERROR) または不正 ID (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/users/{id}/mute',
    tags: ['users'],
    summary: 'ユーザーをミュート（冪等）',
    description: [
      '対象ユーザーをミュートする。既にミュート済みでも 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- ミュートはフォロー関係を変更しない',
      '- ミュートは相手には通知されない（非公開機能）',
      '- 自己ミュートは 400 VALIDATION_ERROR',
      '- 対象不在・停止ユーザーは 404 NOT_FOUND',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: mute_user（10/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'ミュート対象ユーザー ID（cuid）' }) }),
    },
    responses: {
      200: {
        description: 'ミュート成功（既ミュートでも 200）',
        content: { 'application/json': { schema: MuteResponse } },
      },
      400: errorResponse('自己ミュート (VALIDATION_ERROR) または不正 ID (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('対象ユーザーが存在しないか停止済み (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/users/{id}/mute',
    tags: ['users'],
    summary: 'ミュート解除（冪等）',
    description: [
      '対象ユーザーのミュートを解除する。ミュートしていなくても 200 を返す（冪等設計）。',
      '',
      '重要仕様:',
      '- 自己操作は 400 VALIDATION_ERROR',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: unmute_user（10/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'ミュート解除対象ユーザー ID（cuid）' }) }),
    },
    responses: {
      200: {
        description: 'ミュート解除成功（未ミュートでも 200）',
        content: { 'application/json': { schema: MuteResponse } },
      },
      400: errorResponse('自己操作 (VALIDATION_ERROR) または不正 ID (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me/blocks',
    tags: ['users'],
    summary: 'ブロック一覧取得',
    description: [
      '認証ユーザーがブロックしているユーザーの一覧をカーソルページネーションで返す。',
      '',
      'ゲストアカウントは 403 GUEST_NOT_ALLOWED。',
      'レート制限: api（60/分）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数（デフォルト 20、最大 100）' }),
      }),
    },
    responses: {
      200: {
        description: 'ブロックしているユーザー一覧',
        content: { 'application/json': { schema: UserMinimalListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me/mutes',
    tags: ['users'],
    summary: 'ミュート一覧取得',
    description: [
      '認証ユーザーがミュートしているユーザーの一覧をカーソルページネーションで返す。',
      '',
      'ゲストアカウントは 403 GUEST_NOT_ALLOWED。',
      'レート制限: api（60/分）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数（デフォルト 20、最大 100）' }),
      }),
    },
    responses: {
      200: {
        description: 'ミュートしているユーザー一覧',
        content: { 'application/json': { schema: UserMinimalListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/reports',
    tags: ['reports'],
    summary: '通報を作成',
    description: [
      '投稿・コメント・ユーザー・イベント・盆栽園・レビューを通報する。',
      '',
      '重要仕様:',
      '- targetType は post / comment / event / shop / review / user のいずれか',
      '- reason は spam / inappropriate / harassment / copyright / other のいずれか',
      '- 自己通報（対象の所有者が自分）は 400 VALIDATION_ERROR',
      '- 重複通報（同一 reporterId + targetType + targetId の組み合わせ）は 409 CONFLICT',
      '- 対象が存在しない場合は 404 NOT_FOUND',
      '- 同一対象の通報数が 10 件（AUTO_HIDE_THRESHOLD）に達すると自動非表示処理が発火する',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: create_report（5/分）、超過時は 429 + Retry-After ヘッダー',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: CreateReportRequest },
        },
      },
    },
    responses: {
      200: {
        description: '通報成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な targetType / reason / 自己通報'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('通報対象が存在しない (NOT_FOUND)'),
      409: errorResponse('既に通報済み (CONFLICT)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/notifications/read',
    tags: ['notifications'],
    summary: '通知を既読化',
    description: [
      '通知を既読状態に更新する。',
      '',
      '重要仕様:',
      '- ids 指定: その通知群を既読化（userId 一致でのみ更新し、他ユーザーの通知は変更不可）',
      '- ids 省略または空配列: 当該ユーザーの全未読を既読化',
      '- ids は最大 100 件（MAX_NOTIFICATION_READ_IDS）',
      '- unreadCount はミュートユーザーを除いた操作後の未読数（バッジ即時更新に使用）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: false,
        content: {
          'application/json': { schema: NotificationReadRequest },
        },
      },
    },
    responses: {
      200: {
        description: '既読化成功。unreadCount は操作後の未読数',
        content: { 'application/json': { schema: NotificationReadResponse } },
      },
      400: errorResponse('バリデーションエラー: ids が配列でないか 100 件超 (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/notifications/unread-count',
    tags: ['notifications'],
    summary: '未読通知件数取得',
    description: [
      '認証ユーザーの未読通知件数を返す。',
      '',
      'ゲストユーザーは利用不可（403 GUEST_NOT_ALLOWED）。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '未読通知件数',
        content: { 'application/json': { schema: UnreadCountResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse(
        'アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)',
      ),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // Batch 2c — 投稿 CRUD + コメント作成/削除パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/v1/posts',
    tags: ['posts'],
    summary: '投稿を作成する',
    description: [
      '新規投稿を作成する。content または mediaUrls のどちらか一方は必須。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- content 上限: 無料 500 文字 / プレミアム 2000 文字',
      '- 画像上限: 無料 4 枚 / プレミアム 6 枚',
      '- 動画: 無料不可（400 VALIDATION_ERROR）/ プレミアム 1 本',
      '- ジャンル最大 3 つ。超過時は 400 VALIDATION_ERROR',
      '- 1 日投稿上限: 無料 20 件 / プレミアム 40 件。超過時は 429 RATE_LIMITED',
      '- レート制限: post（3/分）',
      '- 成功レスポンス: 201 + 作成後の投稿詳細（楽観挿入に使用可）',
      '- bonsai 紐付け・アンケートは本バッチ対象外',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: CreatePostRequest },
        },
      },
    },
    responses: {
      201: {
        description: '投稿作成成功。作成後の投稿詳細を返す',
        content: { 'application/json': { schema: PostResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 本文長超過・メディア枚数超過・ジャンル数超過・純粋リポスト編集等'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/posts/{id}',
    tags: ['posts'],
    summary: '投稿を編集する（所有者のみ）',
    description: [
      '既存投稿の本文・ジャンル・メディアを編集する。所有者のみ。',
      '',
      '重要仕様:',
      '- 純粋リポストは編集不可（400 VALIDATION_ERROR）',
      '- ジャンル・メディアは差し替え方式（既存を全て置換）',
      '- 1 日投稿上限は消費しない',
      '- editedAt が更新される（「編集済み」の表示に使用）',
      '- 所有者でない場合は 403 PERMISSION_DENIED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: engagement（30/分）',
      '- 成功レスポンス: 200 + 編集後の投稿詳細',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: UpdatePostRequest },
        },
      },
    },
    responses: {
      200: {
        description: '編集成功。編集後の投稿詳細を返す',
        content: { 'application/json': { schema: PostResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 本文長超過・メディア枚数超過・ジャンル数超過・純粋リポスト編集等'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 所有者でない (VALIDATION_ERROR)'),
      404: errorResponse('投稿が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/posts/{id}',
    tags: ['posts'],
    summary: '投稿を削除する（所有者のみ）',
    description: [
      '投稿を削除する。所有者のみ。R2 メディアのストレージ削除も実施（best-effort）。',
      '',
      '重要仕様:',
      '- 所有者でない場合は 403 PERMISSION_DENIED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: delete_post（5/分）',
      '- 成功レスポンス: 200 { success: true }',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
    },
    responses: {
      200: {
        description: '削除成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 所有者でない (VALIDATION_ERROR)'),
      404: errorResponse('投稿が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/posts/{id}/comments',
    tags: ['posts'],
    summary: 'コメントを作成する',
    description: [
      '指定投稿にコメントを作成する。content または mediaUrls のどちらか一方は必須。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 不可視投稿（非表示・非公開著者・停止著者）は 404 NOT_FOUND',
      '- parentId 指定で返信コメント（スレッド参加者全員へ reply 通知）',
      '- parentId なしで新規コメント（投稿オーナーへ comment 通知）',
      '- 本文最大 500 文字',
      '- 画像最大 2 枚。動画: 無料不可 / プレミアム 1 本',
      '- 1 日コメント上限: 100 件（超過時は 429 RATE_LIMITED）',
      '- レート制限: comment（5/分）',
      '- 成功レスポンス: 201 + 作成後のコメント詳細（楽観挿入に使用可）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '投稿 ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: CreateCommentRequest },
        },
      },
    },
    responses: {
      201: {
        description: 'コメント作成成功。作成後のコメント詳細を返す',
        content: { 'application/json': { schema: CommentResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 本文超過・メディア枚数超過等'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないか閲覧権限なし (NOT_FOUND) / 親コメントが不正 (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/posts/{id}/comments/{commentId}',
    tags: ['posts'],
    summary: 'コメントを削除する（コメント所有者または投稿所有者）',
    description: [
      'コメントをソフトデリートする（deletedAt 設定）。',
      'コメント所有者または投稿所有者が削除可能。',
      '',
      '重要仕様:',
      '- コメント所有者でも投稿所有者でもない場合は 403 PERMISSION_DENIED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: delete_comment（10/分）',
      '- 成功レスポンス: 200 { success: true }',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '投稿 ID' }),
        commentId: z.string().openapi({ description: 'コメント ID' }),
      }),
    },
    responses: {
      200: {
        description: '削除成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 所有者でない (VALIDATION_ERROR)'),
      404: errorResponse('コメントが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // Batch 2c-upload — メディアアップロードスキーマ登録
  // ──────────────────────────────────────────────────

  const PresignedUploadRequest = registry.register(
    'PresignedUploadRequest',
    presignedUploadRequestSchema.openapi({
      description: [
        '動画 presigned PUT URL のリクエスト。',
        'contentType は video/mp4, video/quicktime, video/webm のいずれか。',
        'fileSize は正の整数（バイト）で MAX_VIDEO_SIZE（80MB）以下。',
        'folder のデフォルトは post-videos。',
      ].join('\n'),
    }),
  )

  const PresignedUploadResponse = registry.register(
    'PresignedUploadResponse',
    presignedUploadResponseSchema.openapi({
      description: [
        '動画 presigned PUT URL のレスポンス。',
        'uploadUrl に PUT リクエストを送る際は Content-Type と Content-Length をヘッダーに付与すること。',
        'fileUrl は自社ストレージの公開 URL で、投稿作成時の mediaUrls にそのまま渡せる。',
        'key は R2 オブジェクトキー（削除時などに参照）。',
      ].join('\n'),
    }),
  )

  const ImageUploadResponse = registry.register(
    'ImageUploadResponse',
    imageUploadResponseSchema.openapi({
      description: [
        '画像アップロード成功のレスポンス。',
        'url は EXIF/GPS/IPTC を除去済みの自社ストレージ公開 URL。',
        '投稿作成時の mediaUrls にそのまま渡せる。',
      ].join('\n'),
    }),
  )

  registry.registerPath({
    method: 'post',
    path: '/api/v1/upload/presigned',
    tags: ['upload'],
    summary: '動画 presigned PUT URL を取得（プレミアム限定）',
    description: [
      '動画を R2 へ直接アップロードするための presigned PUT URL を発行する。',
      'クライアントはこの URL に PUT リクエストを送り、完了後に fileUrl を投稿 mediaUrls に使用する。',
      '',
      '重要仕様:',
      '- 動画アップロードはプレミアム会員限定（403 PREMIUM_REQUIRED）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- PUT 時は Content-Type ヘッダーに requestBody と同じ contentType を指定すること',
      '- PUT 時は Content-Length ヘッダーに requestBody と同じ fileSize を指定すること（Content-Length が署名対象のためサイズ迂回不可）',
      '- presigned URL 有効期限: 3600 秒（1 時間）',
      '- レート制限: upload（5/分）、日次上限あり（fail-closed）',
      '- 取得した uploadUrl とトークンはログに出力しないこと（セキュリティ）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: PresignedUploadRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'presigned PUT URL 発行成功',
        content: { 'application/json': { schema: PresignedUploadResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な contentType / fileSize / folder'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー — presigned URL 生成失敗 (INTERNAL_ERROR)'),
      503: errorResponse('ストレージ未設定 (SERVER_MISCONFIGURED)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/upload/image',
    tags: ['upload'],
    summary: '画像をアップロード（プレミアム不問）',
    description: [
      '画像ファイルを multipart/form-data で受け取り、EXIF/GPS/IPTC 除去後に R2 へ保存する。',
      'レスポンスの url を投稿作成時の mediaUrls に使用する。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 画像はプレミアム不問（枚数制限は POST /api/v1/posts 作成時に強制）',
      '- form-data のキー名は "file"',
      '- 対応形式: JPEG / PNG / WebP（マジックバイトで実 MIME を検証。申告 Content-Type 偽装は拒否）',
      '- 最大サイズ: 4MB',
      '- EXIF / GPS / IPTC は必ずサーバーで除去される（プライバシー保護）',
      '- EXIF orientation は物理画素に焼き込んでから除去するため向きが保持される',
      '- レート制限: upload（5/分）、日次上限あり（fail-closed）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            // zod-to-openapi は z.instanceof(File) を処理できないため手書き schema で表現する
            schema: z.object({
              file: z.string().openapi({
                description: 'アップロードする画像ファイル（JPEG / PNG / WebP、最大 4MB）',
                format: 'binary',
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: '画像アップロード成功。url は EXIF/GPS 除去済みの公開 URL',
        content: { 'application/json': { schema: ImageUploadResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — ファイル未選択 / 形式不正 / サイズ超過'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー — ストレージ保存失敗 (INTERNAL_ERROR)'),
    },
  })

  // ──────────────────────────────────────────────────
  // Phase 3 Batch 3a — Push 通知デバイストークン登録/解除
  // ──────────────────────────────────────────────────

  const RegisterDeviceRequest = registry.register(
    'RegisterDeviceRequest',
    registerDeviceRequestSchema.openapi({
      description: [
        'Push 通知デバイストークン登録リクエスト。',
        'token は Expo / APNs / FCM の Push トークン文字列。',
        'platform は android または ios。',
      ].join('\n'),
    }),
  )

  registry.registerPath({
    method: 'post',
    path: '/api/v1/devices',
    tags: ['devices'],
    summary: 'Push 通知デバイストークンを登録（冪等な upsert）',
    description: [
      'Expo / APNs / FCM の Push トークンを登録する。',
      '',
      '重要仕様:',
      '- 冪等設計: 同じ token を再度 POST しても 200 を返す（upsert）',
      '- 既存トークンに別のユーザーが紐付いている場合は現所有者に付け替える（端末譲渡・再インストール対応）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: register_device（10/分）',
      '- トークン文字列はログ・エラーメッセージに出力しない（秘匿扱い）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: RegisterDeviceRequest },
        },
      },
    },
    responses: {
      200: {
        description: '登録成功（既存トークンの upsert も含む）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — token 空文字・長さ超過・platform 値不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/devices/{token}',
    tags: ['devices'],
    summary: 'Push 通知デバイストークンを解除（冪等・自分のトークンのみ）',
    description: [
      '指定した Push トークンの登録を解除する。',
      '',
      '重要仕様:',
      '- 冪等設計: 存在しないトークンを DELETE しても 200 を返す（fail-safe）',
      '- 自分のトークンのみ削除可。他人のトークン ID を指定しても何も起きず 200 を返す（情報漏洩しない）',
      '- Expo トークン（ExponentPushToken[...]）は [ ] を含むため URL エンコードが必要。',
      '  例: ExponentPushToken[abc123] → /api/v1/devices/ExponentPushToken%5Babc123%5D',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: remove_device（10/分）',
      '- トークン文字列はログ・エラーメッセージに出力しない（秘匿扱い）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        token: z.string().openapi({
          description: 'Push トークン文字列（URL エンコード済み）',
        }),
      }),
    },
    responses: {
      200: {
        description: '解除成功（存在しないトークン・他人のトークンも 200）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — token 長さ超過'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // Batch 3a — ブックマーク + 発見/explore パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/v1/posts/{id}/bookmark',
    tags: ['bookmarks'],
    summary: '投稿をブックマークに追加する（冪等）',
    description: [
      '指定した投稿をブックマークに追加する。',
      '',
      '重要仕様:',
      '- 冪等設計: 既にブックマーク済みでも 200 を返す',
      '- 不存在・不可視（非公開著者・停止著者・isHidden=true）の投稿は 404 NOT_FOUND',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '投稿 ID' }),
      }),
    },
    responses: {
      200: {
        description: 'ブックマーク追加成功（冪等: 既ブックマークでも 200）',
        content: { 'application/json': { schema: BookmarkResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — id 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないまたは閲覧不可 (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/posts/{id}/bookmark',
    tags: ['bookmarks'],
    summary: '投稿のブックマークを解除する（冪等）',
    description: [
      '指定した投稿のブックマークを解除する。',
      '',
      '重要仕様:',
      '- 冪等設計: 未ブックマーク状態でも 200 を返す',
      '- 不存在・不可視（非公開著者・停止著者・isHidden=true）の投稿は 404 NOT_FOUND',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '投稿 ID' }),
      }),
    },
    responses: {
      200: {
        description: 'ブックマーク解除成功（冪等: 未ブックマークでも 200）',
        content: { 'application/json': { schema: BookmarkResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — id 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('投稿が存在しないまたは閲覧不可 (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/polls/{id}/vote',
    tags: ['polls'],
    summary: 'アンケートに投票する',
    description: [
      '指定アンケートに 1 票を投じる。',
      '',
      '重要仕様:',
      '- 投票は 1 ユーザー 1 回のみ（二重投票は 400 VALIDATION_ERROR）',
      '- 期限切れアンケートへの投票は 400 VALIDATION_ERROR',
      '- 不正な optionId（当該アンケートに属さない）は 400 VALIDATION_ERROR',
      '- アンケートが存在しない場合は 404 NOT_FOUND',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 成功時は最新の集計結果（percentage 付き）を返す',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'アンケート ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: PollVoteRequest },
        },
      },
    },
    responses: {
      200: {
        description: '投票成功。最新の集計結果を返す',
        content: { 'application/json': { schema: PollVoteResponse } },
      },
      400: errorResponse(
        'バリデーションエラー (VALIDATION_ERROR) — 二重投票 / 期限切れ / 不正 optionId',
      ),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('アンケートが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me/bookmarks',
    tags: ['bookmarks'],
    summary: 'ブックマーク投稿一覧を取得する（カーソルページネーション）',
    description: [
      'ログインユーザーがブックマークした投稿を新しい順（ブックマーク日時降順）で返す。',
      '',
      '重要仕様:',
      '- カーソルキー: Bookmark.id（ブックマーク操作順）',
      '- 可視性フィルタ: ブックマーク後に非公開化・停止・isHidden になった投稿は除外',
      '- items は feed と同等の投稿形式（mentionedUsers / isBlocked / isMuted / isBookmarked=true 付き）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（1〜100、デフォルト 20）' }),
      }),
    },
    responses: {
      200: {
        description: 'ブックマーク投稿一覧取得成功',
        content: { 'application/json': { schema: BookmarksListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — cursor/limit 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/explore/trending-hashtags',
    tags: ['explore'],
    summary: 'トレンドハッシュタグ一覧を取得する',
    description: [
      '使用数（count）降順でハッシュタグ一覧を返す。',
      '',
      '重要仕様:',
      '- count は Hashtag テーブルの累計投稿数（PostHashtag の行数に基づく）',
      '- count=0 のハッシュタグは除外する',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（1〜100、デフォルト 10）' }),
      }),
    },
    responses: {
      200: {
        description: 'トレンドハッシュタグ一覧取得成功',
        content: { 'application/json': { schema: TrendingHashtagsResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — limit 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/explore/trending-genres',
    tags: ['explore'],
    summary: 'トレンドジャンル一覧を取得する',
    description: [
      '直近 48 時間の投稿数（postCount）降順でジャンルを返す。',
      '',
      '重要仕様:',
      '- postCount は直近 48 時間の公開投稿数（非表示・非公開著者・停止著者を除外）',
      '- postCount=0 のジャンルは除外される（投稿がないジャンルは含まれない）',
      '- 結果は unstable_cache（TTL: CACHE_TTL_TRENDING 秒）でキャッシュされる',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（1〜100、デフォルト 10）' }),
      }),
    },
    responses: {
      200: {
        description: 'トレンドジャンル一覧取得成功',
        content: { 'application/json': { schema: TrendingGenresResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — limit 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/explore/recommended-users',
    tags: ['explore'],
    summary: 'おすすめユーザー一覧を取得する',
    description: [
      'フォロワー数降順でおすすめユーザーを返す。',
      '',
      '重要仕様:',
      '- 除外対象: 自分自身・既フォロー中・双方向ブロック・非公開アカウント・停止ユーザー・ゲストユーザー',
      '- ゲストトークンでは空配列を返す（フォロー状態が計算できないため）',
      '- following / requested は閲覧者のフォロー状態。following と requested は同時に true にならない',
      '- isPublic は常に true（非公開アカウントは除外済み）だが明示的に返す',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（1〜100、デフォルト 10）' }),
      }),
    },
    responses: {
      200: {
        description: 'おすすめユーザー一覧取得成功（ゲスト時は空配列）',
        content: { 'application/json': { schema: RecommendedUsersResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — limit 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // Batch 3b — 辞典・施肥・ホルモン スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'DictionaryCategory',
    dictionaryCategorySchema.openapi({
      description: '辞典カテゴリ enum（7 固定値）: 樹形 / 技術・作業 / 管理・育成 / 道具・用品 / 盆器・鉢 / 用土・肥料 / 展示・鑑賞。',
    }),
  )

  registry.register(
    'KanaRow',
    kanaRowSchema.openapi({
      description: '五十音行 enum（10 行）: あ行〜わ行。reading 先頭文字に基づく in-memory フィルタで使用。',
    }),
  )

  registry.register(
    'DictionaryTermSummary',
    dictionaryTermSummarySchema.openapi({
      description: '辞典用語の一覧項目（description 省略）。',
    }),
  )

  registry.register(
    'DictionaryTermDetail',
    dictionaryTermDetailSchema.openapi({
      description: '辞典用語の詳細（description を含む）。',
    }),
  )

  const DictionaryListResponse = registry.register(
    'DictionaryListResponse',
    dictionaryListResponseSchema.openapi({
      description: 'GET /api/v1/dictionary 成功レスポンス。reading ASC / sortOrder ASC 順。',
    }),
  )

  const DictionaryDetailResponse = registry.register(
    'DictionaryDetailResponse',
    dictionaryDetailResponseSchema.openapi({
      description: 'GET /api/v1/dictionary/{slug} 成功レスポンス。prev/next/related を含む。',
    }),
  )

  registry.register(
    'NutrientCategory',
    nutrientCategorySchema.openapi({
      description: '栄養素カテゴリ enum: primary（三大要素）/ secondary（二次要素）/ trace（微量要素）。',
    }),
  )

  registry.register(
    'TreeCategory',
    treeCategorySchema.openapi({
      description: '樹種カテゴリ enum: conifer（松柏類）/ deciduous（雑木類）/ flowering（花物）/ fruiting（実物）/ grass（草物）/ evergreen（常緑広葉樹）。',
    }),
  )

  registry.register(
    'FertilizerAction',
    fertilizerActionSchema.openapi({
      description: '施肥アクション enum: none（施肥不要）/ light（控えめ）/ moderate（通常量）/ heavy（たっぷり）。',
    }),
  )

  registry.register(
    'NutrientLevel',
    nutrientLevelSchema.openapi({
      description: '栄養素レベル enum: high（多め）/ balanced（バランス）/ low（控えめ）/ none（不要）。',
    }),
  )

  registry.register(
    'NutrientItem',
    nutrientItemSchema.openapi({
      description: '栄養素一覧の 1 件（deficiencySymptoms 等は詳細のみ）。',
    }),
  )

  const NutrientDetail = registry.register(
    'NutrientDetail',
    nutrientDetailSchema.openapi({
      description: '栄養素詳細（deficiencySymptoms / excessSymptoms / foodSources を含む）。',
    }),
  )

  const FertilizerCategoryItem = registry.register(
    'FertilizerCategoryItem',
    fertilizerCategoryItemSchema.openapi({
      description: '肥料カテゴリ 1 件（code, name, description, merit, demerit, bonsaiUsage, slug）。',
    }),
  )

  registry.register(
    'TreeSpeciesItem',
    treeSpeciesItemSchema.openapi({
      description: '樹種一覧の 1 件（id, name, category, fertilizingPolicy, slug）。',
    }),
  )

  registry.register(
    'FertilizationMonth',
    fertilizationMonthSchema.openapi({
      description: '月別施肥データ 1 件（month 1〜12、action、各栄養素レベル、推奨肥料タイプ、備考）。',
    }),
  )

  const FertilizationScheduleResponse = registry.register(
    'FertilizationScheduleResponse',
    fertilizationScheduleResponseSchema.openapi({
      description: 'GET /api/v1/fertilizers/tree-species/{slug}/schedule 成功レスポンス。treeSpeciesName・slug を含む。months は月順で最大 12 件。',
    }),
  )

  registry.register(
    'HormoneCategory',
    hormoneCategorySchema.openapi({
      description: 'ホルモンカテゴリ enum: major（主要ホルモン）/ secondary（補助ホルモン）。',
    }),
  )

  registry.register(
    'HormoneItem',
    hormoneItemSchema.openapi({
      description: 'ホルモン一覧の 1 件（id, name, nameEn, slug, category, chemicalFormula, description）。',
    }),
  )

  registry.register(
    'HormoneEffect',
    hormoneEffectSchema.openapi({
      description: 'ホルモン効果 1 件（effectName, isPromoting）。isPromoting=true: 促進 / false: 抑制。',
    }),
  )

  registry.register(
    'HormoneSeasonalLevel',
    hormoneSeasonalLevelSchema.openapi({
      description: '月別ホルモン活性 1 件（month 1〜12、level: high / moderate / low / minimal）。',
    }),
  )

  const HormoneDetail = registry.register(
    'HormoneDetail',
    hormoneDetailSchema.openapi({
      description: 'ホルモン詳細（bonsaiRole / productionSite / practicalTips / activationMethod / effects / seasonalLevels を含む）。interactions/techniques は別バッチで追加予定。',
    }),
  )

  // ──────────────────────────────────────────────────
  // Batch 3b — 辞典・施肥・ホルモン パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/dictionary',
    tags: ['dictionary'],
    summary: '盆栽用語辞典一覧',
    description: [
      '盆栽用語をカーソルページネーションで返す。reading ASC / sortOrder ASC 順。',
      '',
      '重要仕様:',
      '- search: term / reading / description の部分一致（contains 検索）',
      '- category: 7 固定カテゴリ（DictionaryCategory enum）でフィルタ',
      '- row: 五十音行（KanaRow enum、10 行）でフィルタ。in-memory 適用のためカーソルと組み合わせると挙動が変わる',
      '- row 指定時はカーソルなし全件返却（最大 limit 件）',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値（slug）' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（デフォルト 20、最大 100）' }),
        search: z.string().optional().openapi({ description: '検索キーワード（term / reading / description 部分一致）' }),
        category: z.string().optional().openapi({ description: '辞典カテゴリフィルタ（DictionaryCategory enum）' }),
        row: z.string().optional().openapi({ description: '五十音行フィルタ（KanaRow enum: あ行〜わ行）' }),
      }),
    },
    responses: {
      200: {
        description: '用語一覧取得成功',
        content: { 'application/json': { schema: DictionaryListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な category / row / limit'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/dictionary/{slug}',
    tags: ['dictionary'],
    summary: '盆栽用語辞典詳細',
    description: [
      '指定 slug の用語詳細を返す。prev / next / related（同カテゴリ最大 6 件）を含む。',
      '',
      '重要仕様:',
      '- slug 不存在は 404 NOT_FOUND',
      '- prev / next は同カテゴリ内の reading ASC 順での前後',
      '- related は同カテゴリの他の用語（最大 6 件、reading ASC 順）',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string().openapi({ description: '用語の slug' }) }),
    },
    responses: {
      200: {
        description: '用語詳細取得成功',
        content: { 'application/json': { schema: DictionaryDetailResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — slug 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('用語が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/fertilizers/nutrients',
    tags: ['fertilizers'],
    summary: '栄養素一覧',
    description: [
      '肥料栄養素の一覧を全件返却する（件数が少ないためカーソル不要）。',
      '',
      '重要仕様:',
      '- category: NutrientCategory enum（primary / secondary / trace）でフィルタ',
      '- sortOrder ASC / name ASC 順',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        category: z.string().optional().openapi({ description: 'NutrientCategory enum でフィルタ（省略で全件）' }),
      }),
    },
    responses: {
      200: {
        description: '栄養素一覧取得成功',
        content: { 'application/json': { schema: z.array(nutrientItemSchema) } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な category'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/fertilizers/nutrients/{slug}',
    tags: ['fertilizers'],
    summary: '栄養素詳細',
    description: [
      '指定 slug の栄養素詳細を返す。deficiencySymptoms / excessSymptoms / foodSources を含む。',
      '',
      '重要仕様:',
      '- slug 不存在は 404 NOT_FOUND',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string().openapi({ description: '栄養素の slug' }) }),
    },
    responses: {
      200: {
        description: '栄養素詳細取得成功',
        content: { 'application/json': { schema: NutrientDetail } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — slug 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('栄養素が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/fertilizers/categories',
    tags: ['fertilizers'],
    summary: '肥料カテゴリ一覧',
    description: [
      '肥料カテゴリの一覧を全件返却する（sortOrder ASC 順）。',
      '',
      '重要仕様:',
      '- フィルタなし（全件返却）',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '肥料カテゴリ一覧取得成功',
        content: { 'application/json': { schema: z.array(fertilizerCategoryItemSchema) } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/fertilizers/tree-species',
    tags: ['fertilizers'],
    summary: '樹種一覧',
    description: [
      '樹種の一覧を全件返却する（sortOrder ASC / name ASC 順）。',
      '',
      '重要仕様:',
      '- category: TreeCategory enum（conifer / deciduous / flowering / fruiting / grass / evergreen）でフィルタ',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        category: z.string().optional().openapi({ description: 'TreeCategory enum でフィルタ（省略で全件）' }),
      }),
    },
    responses: {
      200: {
        description: '樹種一覧取得成功',
        content: { 'application/json': { schema: z.array(treeSpeciesItemSchema) } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な category'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/fertilizers/tree-species/{slug}/schedule',
    tags: ['fertilizers'],
    summary: '樹種別施肥スケジュール',
    description: [
      '指定 slug の樹種に対する月別施肥スケジュールを返す（month 1〜12 の昇順）。',
      '',
      '重要仕様:',
      '- slug 不存在は 404 NOT_FOUND',
      '- months の件数はデータ次第（最大 12）。登録がない月は含まれない',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string().openapi({ description: '樹種の slug' }) }),
    },
    responses: {
      200: {
        description: '施肥スケジュール取得成功',
        content: { 'application/json': { schema: FertilizationScheduleResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — slug 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('樹種が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/hormones',
    tags: ['hormones'],
    summary: '植物ホルモン一覧',
    description: [
      '植物ホルモンの一覧を全件返却する（sortOrder ASC / name ASC 順）。',
      '',
      '重要仕様:',
      '- category: HormoneCategory enum（major / secondary）でフィルタ',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        category: z.string().optional().openapi({ description: 'HormoneCategory enum でフィルタ（省略で全件）' }),
      }),
    },
    responses: {
      200: {
        description: 'ホルモン一覧取得成功',
        content: { 'application/json': { schema: z.array(hormoneItemSchema) } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な category'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/hormones/{slug}',
    tags: ['hormones'],
    summary: '植物ホルモン詳細',
    description: [
      '指定 slug のホルモン詳細を返す。effects / seasonalLevels を含む。',
      '',
      '重要仕様:',
      '- slug 不存在は 404 NOT_FOUND',
      '- effects は isPromoting による促進/抑制効果の一覧（sortOrder ASC）',
      '- seasonalLevels は月別活性レベル（month 1〜12 ASC）',
      '- interactions（ホルモン間相互作用）/ techniques（技法マッピング）は本バッチ対象外',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string().openapi({ description: 'ホルモンの slug' }) }),
    },
    responses: {
      200: {
        description: 'ホルモン詳細取得成功',
        content: { 'application/json': { schema: HormoneDetail } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — slug 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('ホルモンが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // Batch 3c — 農薬・病害虫図鑑 スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'DiseasePestCategory',
    diseasePestCategorySchema.openapi({
      description: '病害虫カテゴリ enum: disease（病害）/ pest（害虫）/ beneficial_insect（益虫）。',
    }),
  )

  registry.register(
    'PesticideType',
    pesticideTypeSchema.openapi({
      description: '農薬種別 enum: fungicide（殺菌剤）/ insecticide（殺虫剤）/ acaricide（殺ダニ剤）/ compound（複合剤）/ other。',
    }),
  )

  registry.register(
    'EffectRating',
    effectRatingSchema.openapi({
      description: '効果レーティング enum: excellent（◎）/ good（○）/ fair（△）/ poor（×）/ none（効果なし）。',
    }),
  )

  registry.register(
    'ResistanceRisk',
    resistanceRiskSchema.openapi({
      description: '耐性リスク enum: low（つきにくい）/ medium（ややつきやすい）/ high（つきやすい）。',
    }),
  )

  registry.register(
    'DiseasePestItem',
    diseasePestItemSchema.openapi({
      description: '病害虫一覧の 1 件（id, name, nameKana, category, description, imageUrl, slug）。',
    }),
  )

  registry.register(
    'DiseasePestEffectItem',
    diseasePestEffectItemSchema.openapi({
      description: '病害虫詳細の農薬効果 1 件（pesticide 情報 + rating）。',
    }),
  )

  registry.register(
    'DiseasePestDetail',
    diseasePestDetailSchema.openapi({
      description: '病害虫詳細（effects: 有効農薬一覧を含む）。',
    }),
  )

  const DiseasePestListResponse = registry.register(
    'DiseasePestListResponse',
    diseasePestListResponseSchema.openapi({
      description: 'GET /api/v1/pesticides/disease-pests 成功レスポンス。sortOrder ASC / name ASC 順。',
    }),
  )

  registry.register(
    'PesticideItem',
    pesticideItemSchema.openapi({
      description: '農薬製品一覧の 1 件（id, name, registrationNumber, pesticideType, description, slug）。',
    }),
  )

  registry.register(
    'PesticideActiveIngredientItem',
    pesticideActiveIngredientItemSchema.openapi({
      description: '農薬製品詳細の有効成分 1 件（id, name, fracCode, iracCode, resistanceRisk, slug）。',
    }),
  )

  registry.register(
    'PesticideFormulationType',
    pesticideFormulationTypeSchema.openapi({
      description: '農薬製品の剤型（name, code）。',
    }),
  )

  registry.register(
    'PesticideEffectItem',
    pesticideEffectItemSchema.openapi({
      description: '農薬製品詳細の効果 1 件（diseasePest 情報 + rating）。',
    }),
  )

  registry.register(
    'PesticideIncompatibilityItem',
    pesticideIncompatibilityItemSchema.openapi({
      description: '農薬製品詳細の混用不可農薬 1 件（id, name, slug, formulationTypeName）。',
    }),
  )

  registry.register(
    'PesticideDetail',
    pesticideDetailSchema.openapi({
      description: '農薬製品詳細（formulationType, activeIngredients, effects, incompatibilities を含む）。',
    }),
  )

  const PesticideListResponse = registry.register(
    'PesticideListResponse',
    pesticideListResponseSchema.openapi({
      description: 'GET /api/v1/pesticides/products 成功レスポンス。name ASC 順。',
    }),
  )

  registry.register(
    'IngredientItem',
    ingredientItemSchema.openapi({
      description: '有効成分一覧の 1 件（id, name, nameEn, fracCode, iracCode, resistanceRisk, slug）。',
    }),
  )

  const IngredientDetail = registry.register(
    'IngredientDetail',
    ingredientDetailSchema.openapi({
      description: '有効成分詳細（ingredientGroup, description, pesticides 一覧を含む）。',
    }),
  )

  const IngredientListResponse = registry.register(
    'IngredientListResponse',
    ingredientListResponseSchema.openapi({
      description: 'GET /api/v1/pesticides/ingredients 成功レスポンス。name ASC 順。',
    }),
  )

  // ──────────────────────────────────────────────────
  // Batch 3c — 農薬・病害虫図鑑 パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/pesticides/disease-pests',
    tags: ['pesticides'],
    summary: '病害虫一覧',
    description: [
      '病害虫・病害・益虫の一覧をカーソルページネーションで返す。sortOrder ASC / name ASC 順。',
      '',
      '重要仕様:',
      '- category: DiseasePestCategory enum（disease / pest / beneficial_insect）でフィルタ',
      '- search: name / nameKana / description の部分一致',
      '- bodySizeMm: 体長（mm）で害虫・益虫のみを絞り込む（disease には適用されない）',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値（slug）' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（デフォルト 20、最大 100）' }),
        category: z.string().optional().openapi({ description: 'DiseasePestCategory enum でフィルタ（省略で全件）' }),
        search: z.string().optional().openapi({ description: '検索キーワード（name / nameKana / description 部分一致）' }),
        bodySizeMm: z.number().optional().openapi({ description: '体長（mm）フィルタ。害虫・益虫のみ対象' }),
      }),
    },
    responses: {
      200: {
        description: '病害虫一覧取得成功',
        content: { 'application/json': { schema: DiseasePestListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な category / limit / bodySizeMm'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/pesticides/disease-pests/{slug}',
    tags: ['pesticides'],
    summary: '病害虫詳細',
    description: [
      '指定 slug の病害虫詳細を返す。effects（有効農薬一覧）を含む。',
      '',
      '重要仕様:',
      '- slug 不存在は 404 NOT_FOUND',
      '- effects は pesticide.name ASC 順',
      '- effects[].pesticide には formulationType（剤型、null 可）と activeIngredients（有効成分一覧）を含む',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string().openapi({ description: '病害虫の slug' }) }),
    },
    responses: {
      200: {
        description: '病害虫詳細取得成功',
        content: { 'application/json': { schema: diseasePestDetailSchema } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — slug 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('病害虫が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/pesticides/products',
    tags: ['pesticides'],
    summary: '農薬製品一覧',
    description: [
      '農薬製品の一覧をカーソルページネーションで返す。name ASC 順。',
      '',
      '重要仕様:',
      '- search: name / registrationNumber の部分一致',
      '- type: PesticideType enum（fungicide / insecticide / acaricide / compound / other）でフィルタ。herbicide は other に正規化される',
      '- diseasePestId: 指定した病害虫に効果がある農薬のみ返す',
      '- formulationTypeCode: 剤型コードでフィルタ',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値（slug）' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（デフォルト 20、最大 100）' }),
        search: z.string().optional().openapi({ description: '検索キーワード（name / registrationNumber 部分一致）' }),
        type: z.string().optional().openapi({ description: 'PesticideType enum でフィルタ。herbicide は other に正規化' }),
        diseasePestId: z.string().optional().openapi({ description: '病害虫 ID。この病害虫に効果がある農薬のみ返す' }),
        formulationTypeCode: z.string().optional().openapi({ description: '剤型コードでフィルタ' }),
      }),
    },
    responses: {
      200: {
        description: '農薬製品一覧取得成功',
        content: { 'application/json': { schema: PesticideListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な limit'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/pesticides/products/{slug}',
    tags: ['pesticides'],
    summary: '農薬製品詳細',
    description: [
      '指定 slug の農薬製品詳細を返す。formulationType / activeIngredients / effects / incompatibilities を含む。',
      '',
      '重要仕様:',
      '- slug 不存在は 404 NOT_FOUND',
      '- effects は diseasePest.name ASC 順',
      '- incompatibilities は incompatibleWith.name ASC 順',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string().openapi({ description: '農薬製品の slug' }) }),
    },
    responses: {
      200: {
        description: '農薬製品詳細取得成功',
        content: { 'application/json': { schema: pesticideDetailSchema } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — slug 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('農薬製品が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/pesticides/ingredients',
    tags: ['pesticides'],
    summary: '有効成分一覧',
    description: [
      '農薬有効成分の一覧をカーソルページネーションで返す。name ASC 順。',
      '',
      '重要仕様:',
      '- search: name / nameEn / fracCode / iracCode の部分一致',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値（slug）' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（デフォルト 20、最大 100）' }),
        search: z.string().optional().openapi({ description: '検索キーワード（name / nameEn / fracCode / iracCode 部分一致）' }),
      }),
    },
    responses: {
      200: {
        description: '有効成分一覧取得成功',
        content: { 'application/json': { schema: IngredientListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な limit'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/pesticides/ingredients/{slug}',
    tags: ['pesticides'],
    summary: '有効成分詳細',
    description: [
      '指定 slug の有効成分詳細を返す。ingredientGroup / description / pesticides（使用農薬一覧）を含む。',
      '',
      '重要仕様:',
      '- slug 不存在は 404 NOT_FOUND',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string().openapi({ description: '有効成分の slug' }) }),
    },
    responses: {
      200: {
        description: '有効成分詳細取得成功',
        content: { 'application/json': { schema: IngredientDetail } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — slug 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('有効成分が存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §3.3 マイ盆栽 CRUD スキーマ登録
  // ──────────────────────────────────────────────────

  const CreateBonsaiRequest = registry.register(
    'CreateBonsaiRequest',
    createBonsaiRequestSchema.openapi({
      description: [
        '盆栽作成リクエスト。name は必須（最大 100 文字）。',
        'acquiredAt は ISO 8601 形式の日時文字列（例: "2024-03-15T00:00:00.000Z"）。',
      ].join('\n'),
    }),
  )

  const UpdateBonsaiRequest = registry.register(
    'UpdateBonsaiRequest',
    updateBonsaiRequestSchema.openapi({
      description: [
        '盆栽部分更新リクエスト。全フィールドが optional。',
        'acquiredAt に null を渡すと取得日をクリアする。',
      ].join('\n'),
    }),
  )

  const CreateBonsaiRecordRequest = registry.register(
    'CreateBonsaiRecordRequest',
    createBonsaiRecordRequestSchema.openapi({
      description: [
        '成長記録作成リクエスト。recordAt は必須（ISO 8601）。',
        'mediaUrls は POST /api/v1/upload/image で取得した自社ストレージ URL のみ（外部 URL は 400 VALIDATION_ERROR）。',
        '最大 4 枚。',
      ].join('\n'),
    }),
  )

  const UpdateBonsaiRecordRequest = registry.register(
    'UpdateBonsaiRecordRequest',
    updateBonsaiRecordRequestSchema.openapi({
      description: [
        '成長記録部分更新リクエスト。',
        'mediaUrls 指定時は既存画像を全て置換する（差し替え方式）。省略時は既存画像を維持する。',
      ].join('\n'),
    }),
  )

  registry.register(
    'BonsaiLatestRecord',
    bonsaiLatestRecordSchema.openapi({
      description: '盆栽一覧の最新記録サムネイル情報。',
    }),
  )

  registry.register(
    'BonsaiListItem',
    bonsaiListItemSchema.openapi({
      description: '盆栽一覧の 1 件（最新記録サムネイル付き）。',
    }),
  )

  const BonsaiListResponse = registry.register(
    'BonsaiListResponse',
    bonsaiListResponseSchema.openapi({
      description: '盆栽一覧取得レスポンス。カーソルページネーション形式。',
    }),
  )

  const BonsaiDetail = registry.register(
    'BonsaiDetail',
    bonsaiDetailSchema.openapi({
      description: '盆栽詳細（作成・取得・更新で共用）。',
    }),
  )

  registry.register(
    'BonsaiRecordImage',
    bonsaiRecordImageSchema.openapi({
      description: '成長記録の添付画像 1 件（url + sortOrder）。',
    }),
  )

  registry.register(
    'BonsaiRecordItem',
    bonsaiRecordItemSchema.openapi({
      description: '成長記録 1 件（作成・一覧・更新で共用）。',
    }),
  )

  const BonsaiRecordListResponse = registry.register(
    'BonsaiRecordListResponse',
    bonsaiRecordListResponseSchema.openapi({
      description: '成長記録一覧取得レスポンス。カーソルページネーション形式。',
    }),
  )

  // ── 盆栽 CRUD パス登録 ──────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/bonsai',
    tags: ['bonsai'],
    summary: 'マイ盆栽一覧取得',
    description: [
      '認証ユーザーが所有する盆栽の一覧をカーソルページネーションで返す。',
      '各盆栽には最新の成長記録 1 件とサムネイル画像が含まれる。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: read（60/分）',
      '- 最大取得件数: 200 件（MAX_BONSAI_LIST_LIMIT）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数（デフォルト 20、最大 100）' }),
      }),
    },
    responses: {
      200: {
        description: '盆栽一覧取得成功',
        content: { 'application/json': { schema: BonsaiListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/bonsai',
    tags: ['bonsai'],
    summary: '盆栽を作成する',
    description: [
      '新規盆栽を作成する。name は必須。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: create_bonsai（3/分）',
      '- 成功レスポンス: 201 + 作成後の盆栽詳細',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: CreateBonsaiRequest } },
      },
    },
    responses: {
      201: {
        description: '盆栽作成成功',
        content: { 'application/json': { schema: BonsaiDetail } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — name 未指定・文字数超過等'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/bonsai/{id}',
    tags: ['bonsai'],
    summary: '盆栽詳細取得（所有者のみ）',
    description: [
      '指定 ID の盆栽詳細を返す。所有者以外・不存在は 404（存在を秘匿）。',
      '',
      '重要仕様:',
      '- 他ユーザーの盆栽も不存在も同一の 404 NOT_FOUND で返す（IDOR 防御）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽 ID' }) }),
    },
    responses: {
      200: {
        description: '盆栽詳細取得成功',
        content: { 'application/json': { schema: BonsaiDetail } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('盆栽が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/bonsai/{id}',
    tags: ['bonsai'],
    summary: '盆栽を更新する（所有者のみ）',
    description: [
      '盆栽情報を部分更新する。全フィールドが optional。',
      '',
      '重要仕様:',
      '- 所有者以外・不存在は 404（存在を秘匿）',
      '- acquiredAt に null を渡すと取得日をクリア',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: update_bonsai（5/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽 ID' }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: UpdateBonsaiRequest } },
      },
    },
    responses: {
      200: {
        description: '盆栽更新成功。更新後の盆栽詳細を返す',
        content: { 'application/json': { schema: BonsaiDetail } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('盆栽が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/bonsai/{id}',
    tags: ['bonsai'],
    summary: '盆栽を削除する（所有者のみ）',
    description: [
      '盆栽とその全成長記録・画像を削除する。ストレージ実体も best-effort で削除。',
      '',
      '重要仕様:',
      '- 所有者以外・不存在は 404（存在を秘匿）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: delete_bonsai（5/分）',
      '- 成功レスポンス: 200 { success: true }',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽 ID' }) }),
    },
    responses: {
      200: {
        description: '削除成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('盆栽が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/bonsai/{id}/records',
    tags: ['bonsai'],
    summary: '成長記録一覧取得（所有者のみ）',
    description: [
      '指定盆栽の成長記録をカーソルページネーションで返す（recordAt 降順）。',
      '所有者以外・盆栽不存在は 404。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽 ID' }) }),
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数（デフォルト 20、最大 100）' }),
      }),
    },
    responses: {
      200: {
        description: '成長記録一覧取得成功',
        content: { 'application/json': { schema: BonsaiRecordListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('盆栽が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/bonsai/{id}/records',
    tags: ['bonsai'],
    summary: '成長記録を追加する（所有者のみ）',
    description: [
      '指定盆栽に成長記録を追加する。recordAt は必須。',
      '',
      '重要仕様:',
      '- 所有者以外・盆栽不存在は 404',
      '- mediaUrls は POST /api/v1/upload/image で取得した自社ストレージ URL のみ（外部 URL は 400 VALIDATION_ERROR）',
      '- 画像最大 4 枚（MAX_BONSAI_RECORD_IMAGES）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: create_bonsai_record（5/分）',
      '- 成功レスポンス: 201 + 作成後の成長記録',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽 ID' }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: CreateBonsaiRecordRequest } },
      },
    },
    responses: {
      201: {
        description: '成長記録作成成功',
        content: { 'application/json': { schema: BonsaiDetail } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — recordAt 未指定・mediaUrls が外部 URL 等'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('盆栽が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/bonsai/{id}/records/{recordId}',
    tags: ['bonsai'],
    summary: '成長記録を更新する（所有者のみ）',
    description: [
      '成長記録を部分更新する。mediaUrls 指定時は既存画像を全て置換する。',
      '',
      '重要仕様:',
      '- 所有者以外・記録不存在・盆栽 ID 不一致は 404（存在を秘匿）',
      '- mediaUrls は自社ストレージ URL のみ（外部 URL は 400 VALIDATION_ERROR）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: update_bonsai（5/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '盆栽 ID' }),
        recordId: z.string().openapi({ description: '成長記録 ID' }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: UpdateBonsaiRecordRequest } },
      },
    },
    responses: {
      200: {
        description: '成長記録更新成功。更新後の成長記録を返す',
        content: { 'application/json': { schema: BonsaiDetail } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('記録または盆栽が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/bonsai/{id}/records/{recordId}',
    tags: ['bonsai'],
    summary: '成長記録を削除する（所有者のみ）',
    description: [
      '成長記録とその画像を削除する。ストレージ実体も best-effort で削除。',
      '',
      '重要仕様:',
      '- 所有者以外・記録不存在・盆栽 ID 不一致は 404（存在を秘匿）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: delete_bonsai（5/分）',
      '- 成功レスポンス: 200 { success: true }',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '盆栽 ID' }),
        recordId: z.string().openapi({ description: '成長記録 ID' }),
      }),
    },
    responses: {
      200: {
        description: '削除成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('記録または盆栽が存在しないか閲覧権限なし (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  // ──────────────────────────────────────────────────
  // §3.5 イベント CRUD スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'EventItem',
    eventItemSchema.openapi({
      description: 'イベント 1 件。creator が null の場合は作成者情報が不明（インポートイベント等）。',
    }),
  )

  const EventListResponse = registry.register(
    'EventListResponse',
    eventListResponseSchema.openapi({ description: 'イベント一覧レスポンス（カーソルページネーション）。' }),
  )

  const CreateEventRequest = registry.register(
    'CreateEventRequest',
    createEventRequestSchema.openapi({
      description: [
        'イベント作成リクエスト。title / startDate は必須。',
        'prefecture は任意（都道府県名を日本語で指定）。',
        'externalUrl は完全な URL 形式（https:// を含む）で指定すること。',
        'hasSales: true の場合、グッズ・苗木等の販売あり。',
      ].join('\n'),
    }),
  )

  const UpdateEventRequest = registry.register(
    'UpdateEventRequest',
    updateEventRequestSchema.openapi({
      description: [
        'イベント部分更新リクエスト（作成者のみ）。すべてのフィールドが optional。',
        '省略したフィールドは既存値を維持する。',
        'null を渡すと該当フィールドをクリアする。',
      ].join('\n'),
    }),
  )

  // ──────────────────────────────────────────────────
  // §3.5 イベントパス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/events',
    tags: ['events'],
    summary: 'イベント一覧取得',
    description: [
      'イベントをカーソルページネーションで取得する。ゲスト可。',
      '',
      'フィルタ仕様:',
      '- region: 地方ブロック名（北海道・東北 / 関東 / 中部 / 近畿 / 中国 / 四国 / 九州・沖縄）',
      '- prefecture: 都道府県名（日本語）。region と同時指定した場合は prefecture が優先',
      '- showPast=true: 過去イベントを含む（デフォルト: 今日以降のみ）',
      '- year + month（0-11）: 指定月の開始日が含まれるイベントを取得。showPast より優先',
      '',
      'isHidden=true のイベントは除外される。並び順は startDate 昇順。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数（デフォルト 20、最大 100）' }),
        region: z.string().optional().openapi({
          description: '地方ブロック名でフィルタ（例: 関東 / 九州・沖縄）。prefecture と同時指定した場合は prefecture 優先',
        }),
        prefecture: z.string().optional().openapi({
          description: '都道府県名でフィルタ（例: 東京都）。region より細かい単位で絞り込む',
        }),
        showPast: z.enum(['true', 'false']).optional().openapi({
          description: 'true のとき過去イベントを含む（デフォルト false）。year/month 指定時は無視される',
        }),
        year: z.number().int().optional().openapi({ description: '取得対象の年（month と対で指定）' }),
        month: z.number().int().optional().openapi({ description: '取得対象の月（0-11。month と year は対で指定）' }),
      }),
    },
    responses: {
      200: {
        description: 'イベント一覧取得成功',
        content: { 'application/json': { schema: EventListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な region/prefecture/month/year'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/events/{id}',
    tags: ['events'],
    summary: 'イベント詳細取得',
    description: [
      '指定 ID のイベント詳細を取得する。ゲスト可。',
      'isHidden=true / 不存在の場合は 404 を返す。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'イベント ID' }) }),
    },
    responses: {
      200: {
        description: 'イベント詳細',
        content: { 'application/json': { schema: registry.register('EventItemDetail', eventItemSchema) } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('イベントが存在しないか非表示 (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/events',
    tags: ['events'],
    summary: 'イベントを作成する',
    description: [
      '新規イベントを作成する。認証必須・ゲスト不可。',
      '',
      '重要仕様:',
      '- title / startDate は必須',
      '- startDate / endDate は ISO 8601 形式の日付文字列（例: "2025-07-01"）',
      '- endDate < startDate の場合は 400 VALIDATION_ERROR',
      '- externalUrl は https:// を含む完全 URL 形式',
      '- 作成後のイベント詳細（creator 付き）を 201 で返す',
      '- レート制限: create_event（3/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: CreateEventRequest },
        },
      },
    },
    responses: {
      201: {
        description: 'イベント作成成功。作成後のイベント詳細を返す',
        content: { 'application/json': { schema: registry.register('EventItemCreate', eventItemSchema) } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — title/startDate 必須・日付形式不正・終了日 < 開始日・URL 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/events/{id}',
    tags: ['events'],
    summary: 'イベントを部分更新する（作成者のみ）',
    description: [
      '既存イベントを部分更新する。作成者のみ実行可能。',
      '',
      '重要仕様:',
      '- 省略したフィールドは既存値を維持する',
      '- null を渡すと該当フィールドをクリアする',
      '- 更新後の日付整合性（endDate >= startDate）を検証する',
      '- 作成者でない場合は 403 を返す（他人のイベントと不存在の区別なし）',
      '- レート制限: update_event（5/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'イベント ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: UpdateEventRequest },
        },
      },
    },
    responses: {
      200: {
        description: '更新成功。更新後のイベント詳細を返す',
        content: { 'application/json': { schema: registry.register('EventItemUpdate', eventItemSchema) } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 日付形式不正・終了日 < 開始日・URL 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 作成者でない'),
      404: errorResponse('イベントが存在しないか非表示 (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/events/{id}',
    tags: ['events'],
    summary: 'イベントを削除する（作成者のみ）',
    description: [
      'イベントを完全削除する。作成者のみ実行可能。',
      '',
      '重要仕様:',
      '- 作成者でない場合は 403 を返す（他人のイベントと不存在の区別なし）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: delete_event（5/分）',
      '- 成功レスポンス: 204 No Content',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'イベント ID' }) }),
    },
    responses: {
      204: {
        description: '削除成功（レスポンスボディなし）',
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 作成者でない'),
      404: errorResponse('イベントが存在しないか非表示 (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  // ──────────────────────────────────────────────────
  // §3.4 盆栽園マップ スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'ShopGenreItem',
    shopGenreItemSchema.openapi({ description: '盆栽園ジャンル 1 件（id, name）。' }),
  )

  const ShopItem = registry.register(
    'ShopItem',
    shopItemSchema.openapi({
      description: [
        '盆栽園 1 件。latitude / longitude は Decimal から変換済みの number（小数点以下 7 桁）。',
        'averageRating はレビューがない場合 null。isOwner は閲覧者が作成者なら true。',
      ].join('\n'),
    }),
  )

  const ShopListResponse = registry.register(
    'ShopListResponse',
    shopListResponseSchema.openapi({ description: '盆栽園一覧取得レスポンス。' }),
  )

  const ShopCreatedResponse = registry.register(
    'ShopCreatedResponse',
    shopCreatedResponseSchema.openapi({ description: '盆栽園作成成功レスポンス（id を返す）。' }),
  )

  registry.register(
    'ReviewImage',
    reviewItemSchema.shape.images.element.openapi({ description: 'レビュー画像 1 件（url）。' }),
  )

  registry.register(
    'ReviewUser',
    reviewItemSchema.shape.user.openapi({ description: 'レビュー投稿者の最小情報。' }),
  )

  const ReviewItem = registry.register(
    'ReviewItem',
    reviewItemSchema.openapi({ description: 'レビュー 1 件。images は自社ストレージ URL。' }),
  )

  const ReviewListResponse = registry.register(
    'ReviewListResponse',
    reviewListResponseSchema.openapi({ description: 'レビュー一覧取得レスポンス。' }),
  )

  const GenreListResponse = registry.register(
    'GenreListResponse',
    genreListResponseSchema.openapi({
      description: 'ジャンル一覧取得レスポンス。type=shop で盆栽園用ジャンル、type=post で投稿用ジャンルを返す。',
    }),
  )

  registry.register(
    'ListShopsQuery',
    listShopsQuerySchema.openapi({
      description: 'GET /api/v1/shops クエリパラメータ。sortBy は rating/name/newest/location。region は地方名フィルタ（prefecture 指定時は無視）。',
    }),
  )

  const CreateShopRequest = registry.register(
    'CreateShopRequest',
    createShopRequestSchema.openapi({
      description: [
        '盆栽園作成リクエスト。name / address は必須。',
        'latitude / longitude は Decimal(10,7) 相当の精度で受け付ける。',
        'website は http(s) URL または null。',
        'genreIds は type=shop のジャンル ID（最大 5 件）。',
      ].join('\n'),
    }),
  )

  const UpdateShopRequest = registry.register(
    'UpdateShopRequest',
    updateShopRequestSchema.openapi({
      description: '盆栽園部分更新リクエスト。すべてのフィールドが optional。genreIds 指定時は既存ジャンルを全て置換する。',
    }),
  )

  const CreateReviewRequest = registry.register(
    'CreateReviewRequest',
    createReviewRequestSchema.openapi({
      description: [
        'レビュー投稿リクエスト。rating は 1〜5 の整数。',
        'mediaUrls は POST /api/v1/upload/image で取得した自社ストレージ URL を渡すこと（外部 URL は 400 VALIDATION_ERROR）。',
        '最大 3 枚。@@unique([shopId, userId]) の二重投稿は 409 CONFLICT。',
      ].join('\n'),
    }),
  )

  // ──────────────────────────────────────────────────
  // §3.4 盆栽園マップ パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/shops',
    tags: ['shops'],
    summary: '盆栽園一覧を取得する（ゲスト可）',
    description: [
      '盆栽園をフィルタ・ソート条件付きでカーソルページネーションで返す。',
      '',
      '重要仕様:',
      '- isHidden=true の盆栽園は除外される',
      '- sortBy=rating はメモリソート（DB 集計困難なため）。他は DB 側ソート',
      '- cursor は BonsaiShop.id の lt フィルタとして機能する',
      '- latitude / longitude は Decimal から変換済みの number（null の場合は座標未登録）',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- region と prefecture を同時指定した場合は prefecture が優先される（より狭い絞り込みを尊重）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値（BonsaiShop.id）' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（デフォルト 20、最大 100）' }),
        search: z.string().optional().openapi({ description: '名称・住所の部分一致検索' }),
        genreId: z.string().optional().openapi({ description: 'ジャンル ID でフィルタ（type=shop のジャンルのみ有効）' }),
        prefecture: z.string().optional().openapi({ description: '都道府県でフィルタ（住所の前方一致）。region と同時指定時は prefecture が優先' }),
        region: z.string().optional().openapi({ description: '地方名でフィルタ（北海道 / 東北 / 関東 / 中部 / 近畿 / 中国 / 四国 / 九州沖縄）。prefecture 指定時は無視される' }),
        sortBy: z.string().optional().openapi({ description: 'ソート順: rating / name / newest / location（デフォルト: location）' }),
      }),
    },
    responses: {
      200: {
        description: '盆栽園一覧取得成功',
        content: { 'application/json': { schema: ShopListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な sortBy / prefecture / limit'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/shops',
    tags: ['shops'],
    summary: '盆栽園を登録する（認証必須・ゲスト不可）',
    description: [
      '新しい盆栽園を登録する。同一住所の重複チェックあり（409 CONFLICT）。',
      '',
      '重要仕様:',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 同一住所が既に登録済みの場合は 409 CONFLICT',
      '- latitude / longitude は省略可（地図表示なし状態で登録される）',
      '- genreIds は GET /api/v1/genres?type=shop で取得したジャンル ID（最大 5 件）',
      '- レート制限: create_shop（3/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: CreateShopRequest },
        },
      },
    },
    responses: {
      201: {
        description: '盆栽園登録成功。id を返す',
        content: { 'application/json': { schema: ShopCreatedResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 必須フィールド欠落・URL 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      409: errorResponse('同一住所が既に登録済み (CONFLICT)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/shops/{id}',
    tags: ['shops'],
    summary: '盆栽園詳細を取得する（ゲスト可）',
    description: [
      '指定 id の盆栽園詳細を返す。レビューは GET /api/v1/shops/{id}/reviews で別取得する。',
      '',
      '重要仕様:',
      '- isHidden=true または不存在は 404 NOT_FOUND',
      '- latitude / longitude は Decimal から変換済みの number（null の場合は座標未登録）',
      '- averageRating はレビューがない場合 null',
      '- isOwner は閲覧者が作成者なら true（ゲスト時は false）',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽園 ID' }) }),
    },
    responses: {
      200: {
        description: '盆栽園詳細取得成功',
        content: { 'application/json': { schema: ShopItem } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — id 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      404: errorResponse('盆栽園が存在しないか非表示 (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/shops/{id}',
    tags: ['shops'],
    summary: '盆栽園を編集する（作成者または admin）',
    description: [
      '盆栽園情報を部分更新する。作成者または管理者のみ実行可能。',
      '',
      '重要仕様:',
      '- 作成者でも管理者でもない場合は 403',
      '- 不存在または isHidden=true の場合は 404 NOT_FOUND',
      '- genreIds を指定した場合は既存ジャンルを全て置換する（省略時は変更なし）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: update_shop（5/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽園 ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: UpdateShopRequest },
        },
      },
    },
    responses: {
      200: {
        description: '更新成功',
        content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — URL 形式不正・ジャンル上限超過'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 権限なし'),
      404: errorResponse('盆栽園が存在しないか非表示 (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/shops/{id}/reviews',
    tags: ['shops'],
    summary: 'レビュー一覧を取得する（ゲスト可）',
    description: [
      '盆栽園のレビューをカーソルページネーションで返す。createdAt 降順。',
      '',
      '重要仕様:',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽園 ID' }) }),
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値（ShopReview.id）' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（デフォルト 20、最大 100）' }),
      }),
    },
    responses: {
      200: {
        description: 'レビュー一覧取得成功',
        content: { 'application/json': { schema: ReviewListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — id / limit 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/shops/{id}/reviews',
    tags: ['shops'],
    summary: 'レビューを投稿する（認証必須・ゲスト不可）',
    description: [
      '盆栽園にレビューを投稿する。1 盆栽園につき 1 ユーザー 1 件まで。',
      '',
      '重要仕様:',
      '- @@unique([shopId, userId]) の二重投稿は 409 CONFLICT',
      '- mediaUrls は POST /api/v1/upload/image で取得した自社ストレージ URL のみ許可（外部 URL は 400）',
      '- mediaUrls は最大 3 件（ShopReviewImage として保存される）',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 盆栽園が存在しないか isHidden=true の場合は 404',
      '- レート制限: create_review（3/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '盆栽園 ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: CreateReviewRequest },
        },
      },
    },
    responses: {
      201: {
        description: 'レビュー投稿成功。投稿したレビューを返す',
        content: { 'application/json': { schema: ReviewItem } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — rating 範囲外・mediaUrls 上限超過・外部 URL'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('盆栽園が存在しないか非表示 (NOT_FOUND)'),
      409: errorResponse('同一ユーザーによる二重投稿 (CONFLICT)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/genres',
    tags: ['genres'],
    summary: 'ジャンル一覧を取得する（ゲスト可）',
    description: [
      'type クエリで盆栽園用（shop）または投稿用（post）のジャンルを取得する。',
      '',
      '重要仕様:',
      '- type=shop（デフォルト）: 盆栽園タグ用ジャンル',
      '- type=post: 投稿タグ用ジャンル',
      '- sortOrder / category ASC で返す',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        type: z.string().optional().openapi({ description: 'ジャンル種別: shop（デフォルト）または post' }),
      }),
    },
    responses: {
      200: {
        description: 'ジャンル一覧取得成功',
        content: { 'application/json': { schema: GenreListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正な type'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §3.10 予約投稿 CRUD — スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'ScheduledPostStatus',
    scheduledPostStatusSchema.openapi({
      description: '予約投稿のステータス enum（pending / published / failed / cancelled）。',
    }),
  )

  registry.register(
    'ScheduledPostMediaItem',
    scheduledPostMediaItemSchema.openapi({
      description: '予約投稿に添付されたメディア 1 件（url, type, sortOrder）。',
    }),
  )

  registry.register(
    'ScheduledPostGenreItem',
    scheduledPostGenreItemSchema.openapi({
      description: '予約投稿に紐付くジャンル 1 件（id, name）。',
    }),
  )

  const ScheduledPostItem = registry.register(
    'ScheduledPostItem',
    scheduledPostItemSchema.openapi({
      description: '予約投稿 1 件（一覧・詳細共用）。',
    }),
  )

  const ScheduledPostListResponse = registry.register(
    'ScheduledPostListResponse',
    scheduledPostListResponseSchema.openapi({
      description: '予約投稿一覧レスポンス（カーソルページネーション形式）。',
    }),
  )

  const ScheduledPostCreatedResponse = registry.register(
    'ScheduledPostCreatedResponse',
    scheduledPostCreatedResponseSchema.openapi({
      description: 'POST /api/v1/scheduled-posts 201 — 作成した予約投稿の ID。',
    }),
  )

  const CreateScheduledPostRequest = registry.register(
    'CreateScheduledPostRequest',
    createScheduledPostRequestSchema.openapi({
      description: [
        '予約投稿作成リクエスト（プレミアム会員のみ）。',
        '',
        '制約:',
        `- scheduledAt は未来かつ ${String(MAX_SCHEDULED_DAYS_AHEAD)} 日以内の ISO 8601 文字列`,
        `- pending 件数は ${String(MAX_PENDING_SCHEDULED_POSTS)} 件を超えないこと`,
        '- content / mediaUrls のどちらか一方は必須',
        '- mediaUrls は POST /api/v1/upload/image で取得した自社ストレージ URL のみ許可',
      ].join('\n'),
    }),
  )

  const UpdateScheduledPostRequest = registry.register(
    'UpdateScheduledPostRequest',
    updateScheduledPostRequestSchema.openapi({
      description: [
        '予約投稿更新リクエスト（pending 状態のもののみ）。',
        '',
        '制約:',
        '- pending 以外（published / cancelled / failed）は 400 を返す',
        '- フィールド構成は POST と同一（差し替え方式）',
      ].join('\n'),
    }),
  )

  // ──────────────────────────────────────────────────
  // §3.10 予約投稿 CRUD — パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/scheduled-posts',
    tags: ['scheduled-posts'],
    summary: '予約投稿一覧を取得する（プレミアム限定）',
    description: [
      '自分の予約投稿をカーソルページネーションで取得する。',
      '',
      '重要仕様:',
      '- プレミアム非会員は 403 PREMIUM_REQUIRED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- scheduledAt 昇順で返す',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: 'カーソル（前回レスポンスの nextCursor 値）' }),
        limit: z.number().int().optional().openapi({ description: '1 回の取得上限件数（デフォルト 20）' }),
      }),
    },
    responses: {
      200: {
        description: '予約投稿一覧取得成功',
        content: { 'application/json': { schema: ScheduledPostListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)、ゲスト不可 (GUEST_NOT_ALLOWED)、またはプレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/scheduled-posts',
    tags: ['scheduled-posts'],
    summary: '予約投稿を作成する（プレミアム限定）',
    description: [
      '予約投稿を新規作成する。',
      '',
      '重要仕様:',
      '- プレミアム非会員は 403 PREMIUM_REQUIRED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      `- scheduledAt は未来かつ ${String(MAX_SCHEDULED_DAYS_AHEAD)} 日以内`,
      `- pending 件数が ${String(MAX_PENDING_SCHEDULED_POSTS)} 件に達している場合は 400`,
      '- content / mediaUrls のどちらか一方は必須',
      '- mediaUrls は自社ストレージ URL のみ許可（外部 URL は 400 VALIDATION_ERROR）',
      '- レート制限: create_scheduled_post（3/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: CreateScheduledPostRequest },
        },
      },
    },
    responses: {
      201: {
        description: '予約投稿作成成功。作成した予約投稿の id を返す',
        content: { 'application/json': { schema: ScheduledPostCreatedResponse } },
      },
      400: errorResponse(
        'バリデーションエラー (VALIDATION_ERROR) — scheduledAt 未来必須・30 日超過・pending 上限・content 不足・mediaUrls 外部 URL',
      ),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)、ゲスト不可 (GUEST_NOT_ALLOWED)、またはプレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/scheduled-posts/{id}',
    tags: ['scheduled-posts'],
    summary: '予約投稿詳細を取得する（所有者のみ・プレミアム限定）',
    description: [
      '指定 ID の予約投稿を取得する。',
      '',
      '重要仕様:',
      '- 所有者以外（他人・不存在）は 404 で統一（アクセス有無を秘匿）',
      '- プレミアム非会員は 403 PREMIUM_REQUIRED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '予約投稿 ID' }) }),
    },
    responses: {
      200: {
        description: '予約投稿詳細取得成功',
        content: { 'application/json': { schema: ScheduledPostItem } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)、ゲスト不可 (GUEST_NOT_ALLOWED)、またはプレミアム限定 (PREMIUM_REQUIRED)'),
      404: errorResponse('予約投稿が存在しないか所有者でない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/scheduled-posts/{id}',
    tags: ['scheduled-posts'],
    summary: '予約投稿を更新する（pending のみ・プレミアム限定）',
    description: [
      'pending 状態の予約投稿を更新する。',
      '',
      '重要仕様:',
      '- pending 以外（published / cancelled / failed）は 400 VALIDATION_ERROR',
      '- 所有者以外（他人・不存在）は 404 で統一',
      '- プレミアム非会員は 403 PREMIUM_REQUIRED',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- フィールド構成は POST と同一（差し替え方式）',
      '- レート制限: update_scheduled_post（5/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '予約投稿 ID' }) }),
      body: {
        required: true,
        content: {
          'application/json': { schema: UpdateScheduledPostRequest },
        },
      },
    },
    responses: {
      200: {
        description: '予約投稿更新成功',
        content: { 'application/json': { schema: successSchema } },
      },
      400: errorResponse(
        'バリデーションエラー (VALIDATION_ERROR) — pending 以外の編集・scheduledAt 不正・content 不足・mediaUrls 外部 URL',
      ),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)、ゲスト不可 (GUEST_NOT_ALLOWED)、またはプレミアム限定 (PREMIUM_REQUIRED)'),
      404: errorResponse('予約投稿が存在しないか所有者でない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/scheduled-posts/{id}/cancel',
    tags: ['scheduled-posts'],
    summary: '予約投稿をキャンセルする（ソフトキャンセル・pending のみ）',
    description: [
      '予約投稿のステータスを cancelled に変更する（ハード削除は DELETE を使用）。',
      '',
      '重要仕様:',
      '- cancelled にした投稿は DELETE エンドポイントで後からハード削除できる',
      '- pending 以外は 400 VALIDATION_ERROR',
      '- 所有者以外（他人・不存在）は 404 で統一',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- プレミアム判定は行わない（cancelled 済みを持っている場合も操作可能）',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '予約投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'キャンセル成功',
        content: { 'application/json': { schema: successSchema } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — pending 以外のキャンセル'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('予約投稿が存在しないか所有者でない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/scheduled-posts/{id}',
    tags: ['scheduled-posts'],
    summary: '予約投稿をハード削除する（published 不可）',
    description: [
      '予約投稿と添付メディアを完全削除する。',
      '',
      '重要仕様:',
      '- published 状態は 400 VALIDATION_ERROR（公開済み投稿は削除不可）',
      '- pending / cancelled / failed は削除可能',
      '- 所有者以外（他人・不存在）は 404 で統一',
      '- ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 添付メディアのストレージ実体は best-effort で削除される（DB カスケード後）',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: '予約投稿 ID' }) }),
    },
    responses: {
      200: {
        description: 'ハード削除成功',
        content: { 'application/json': { schema: successSchema } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — published は削除不可'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('予約投稿が存在しないか所有者でない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §3.12 法的文章 — スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'LegalSection',
    legalSectionSchema.openapi({
      description: '法的文章の 1 セクション（見出しと本文）。',
    }),
  )

  const LegalDocumentResponse = registry.register(
    'LegalDocumentResponse',
    legalDocumentSchema.openapi({
      description: 'GET /api/v1/legal/{slug} 200 — 法的文章詳細（slug, title, updatedAt, sections）。',
    }),
  )

  registry.register(
    'LegalListItem',
    legalListItemSchema.openapi({
      description: '法的文章一覧の 1 件（slug, title, updatedAt）。',
    }),
  )

  const LegalListResponse = registry.register(
    'LegalListResponse',
    legalListResponseSchema.openapi({
      description: 'GET /api/v1/legal 200 — 利用可能な法的文章の slug/title 一覧。',
    }),
  )

  // ──────────────────────────────────────────────────
  // §3.12 法的文章 — パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/legal',
    tags: ['legal'],
    summary: '利用可能な法的文章一覧を取得',
    description: [
      '取得可能な法的文章の slug / title / updatedAt 一覧を返す。',
      '',
      '現在の slug: tokushoho（特定商取引法に基づく表記）/ terms（利用規約）/ privacy（プライバシーポリシー）',
      '',
      'ゲストアカウントでも利用可能。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '法的文章一覧取得成功',
        content: { 'application/json': { schema: LegalListResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/legal/{slug}',
    tags: ['legal'],
    summary: '法的文章を slug で取得',
    description: [
      '指定した slug の法的文章を sections 形式（[{ heading, body }]）で返す。',
      '',
      '許可済み slug:',
      '- tokushoho — 特定商取引法に基づく表記',
      '- terms — 利用規約',
      '- privacy — プライバシーポリシー',
      '',
      '許可リスト外の slug は 400 VALIDATION_ERROR を返す（404 ではない）。',
      'ゲストアカウントでも利用可能。',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        slug: z
          .enum(['tokushoho', 'terms', 'privacy'])
          .openapi({ description: '法的文章の識別子。tokushoho / terms / privacy のいずれか。' }),
      }),
    },
    responses: {
      200: {
        description: '法的文章詳細取得成功',
        content: { 'application/json': { schema: LegalDocumentResponse } },
      },
      400: errorResponse('slug が許可リスト外 (VALIDATION_ERROR)'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §3.11 投稿分析サマリ スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'AnalyticsPeriod',
    analyticsPeriodSchema.openapi({ description: '集計期間情報（開始日・終了日・日数）。' }),
  )

  registry.register(
    'AnalyticsTopPost',
    analyticsTopPostSchema.openapi({
      description: '分析サマリのトップ投稿 1 件（エンゲージメント降順で最大 5 件）。',
    }),
  )

  registry.register(
    'AnalyticsPostsSummary',
    analyticsPostsSummarySchema.openapi({
      description: '集計期間内の投稿統計。totalLikes / totalComments は受け取り側の数。',
    }),
  )

  registry.register(
    'AnalyticsDailyEngagement',
    analyticsDailyEngagementSchema.openapi({
      description: '日次エンゲージメント 1 件（date は YYYY-MM-DD 形式）。',
    }),
  )

  registry.register(
    'AnalyticsFollowerGrowthEntry',
    analyticsFollowerGrowthEntrySchema.openapi({
      description: '日次フォロワー増減 1 件（date は YYYY-MM-DD 形式）。',
    }),
  )

  registry.register(
    'AnalyticsFollowersSummary',
    analyticsFollowersSummarySchema.openapi({
      description: '集計期間内のフォロワー統計と日次推移。',
    }),
  )

  const AnalyticsSummaryResponse = registry.register(
    'AnalyticsSummaryResponse',
    analyticsSummaryResponseSchema.openapi({
      description: 'GET /api/v1/analytics/summary の成功レスポンス。プレミアム会員のみ取得可能。',
    }),
  )

  registry.register(
    'AnalyticsSummaryQuery',
    analyticsSummaryQuerySchema.openapi({
      description: '集計期間クエリパラメータ。days は 7 / 30 / 90 の文字列のみ許容（省略時 30）。',
    }),
  )

  // ──────────────────────────────────────────────────
  // §D — 分析拡張エンドポイント スキーマ登録（Wave 3 領域 D）
  // ──────────────────────────────────────────────────

  registry.register(
    'AnalyticsDailyCount',
    analyticsDailyCountSchema.openapi({
      description: '日次カウント 1 件（YYYY-MM-DD + count）。いいね日次分布などで使用。',
    }),
  )

  const AnalyticsPostsResponse = registry.register(
    'AnalyticsPostsResponse',
    analyticsPostsResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/posts の成功レスポンス。',
        'topPosts はエンゲージメント上位 5 件。posts は期間内の全投稿（作成日降順）。',
        'avgEngagement は 1 投稿あたりの（いいね＋コメント）数（小数第 1 位まで）。',
      ].join('\n'),
    }),
  )

  const AnalyticsLikesResponse = registry.register(
    'AnalyticsLikesResponse',
    analyticsLikesResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/likes の成功レスポンス。',
        'hourlyData: 24 要素（0〜23 時）。weekdayData: 7 要素（0=日〜6=土）。',
        'dailyData: YYYY-MM-DD 昇順の日次いいね数。',
      ].join('\n'),
    }),
  )

  registry.register(
    'AnalyticsQuoteItem',
    analyticsQuoteItemSchema.openapi({
      description: '引用投稿 1 件。user は USER_MINIMAL_SELECT 相当（id, nickname, avatarUrl）。',
    }),
  )

  const AnalyticsQuotesResponse = registry.register(
    'AnalyticsQuotesResponse',
    analyticsQuotesResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/quotes の成功レスポンス（days パラメータなし・全期間集計）。',
        'quotes は最大 ANALYTICS_POSTS_LIMIT = 50 件。',
      ].join('\n'),
    }),
  )

  registry.register(
    'AnalyticsKeywordItem',
    analyticsKeywordItemSchema.openapi({
      description: 'キーワード 1 件（word + count）。count 降順。',
    }),
  )

  const AnalyticsKeywordsResponse = registry.register(
    'AnalyticsKeywordsResponse',
    analyticsKeywordsResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/keywords の成功レスポンス。',
        'keywords は出現頻度上位最大 TOP_KEYWORDS_LIMIT = 30 件（頻度降順）。',
        'ストップワード（助詞等）・2 文字未満の単語は除外。',
      ].join('\n'),
    }),
  )

  const AnalyticsEngagementTrendResponse = registry.register(
    'AnalyticsEngagementTrendResponse',
    analyticsEngagementTrendResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/engagement-trend の成功レスポンス。',
        'trend は days 日分の日次エンゲージメント（YYYY-MM-DD 昇順）。',
        'engagement = likes + comments。投稿ゼロの日もエントリが存在する。',
      ].join('\n'),
    }),
  )

  registry.register(
    'AnalyticsGenreItem',
    analyticsGenreItemSchema.openapi({
      description: [
        'ジャンル別パフォーマンス 1 件。',
        '注意: genreId は含まれない（name のみ）。avgEngagement 降順で返る。',
      ].join('\n'),
    }),
  )

  const AnalyticsGenrePerformanceResponse = registry.register(
    'AnalyticsGenrePerformanceResponse',
    analyticsGenrePerformanceResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/genre-performance の成功レスポンス。',
        'genres は avgEngagement 降順、最大 GENRE_PERFORMANCE_LIMIT = 10 件。',
        '注意: genreId は返却されない（実関数の戻り値が name のみ）。',
      ].join('\n'),
    }),
  )

  const AnalyticsFollowerGrowthResponse = registry.register(
    'AnalyticsFollowerGrowthResponse',
    analyticsFollowerGrowthResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/follower-growth の成功レスポンス。',
        'growth の totalFollowers は推定累積値（新規数を積算した近似値）。',
        'currentFollowers は正確な現在値（COUNT クエリ）。',
      ].join('\n'),
    }),
  )

  registry.register(
    'AnalyticsPeriodMetric',
    analyticsPeriodMetricSchema.openapi({
      description: '前期比較の単一指標。change は前期比変化率（%整数）。前期・現期ともに 0 の場合は null。',
    }),
  )

  const AnalyticsPeriodComparisonResponse = registry.register(
    'AnalyticsPeriodComparisonResponse',
    analyticsPeriodComparisonResponseSchema.openapi({
      description: [
        'GET /api/v1/analytics/period-comparison の成功レスポンス。',
        '現期（直近 days 日）と前期（その前 days 日）の比較。',
        '注意: handoff 目安の { current, previous, ratios } 形式とは異なる。',
        '実形は { posts, likes, comments, followers } 各フィールドが { current, previous, change } を持つ。',
      ].join('\n'),
    }),
  )

  // ──────────────────────────────────────────────────
  // §1.20 explore/posts + 盆栽手入れログ スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'ExplorePostsQuery',
    explorePostsQuerySchema.openapi({
      description: [
        'GET /api/v1/explore/posts クエリパラメータ。',
        'hashtag と genreId はどちらか一方のみ指定可（排他）。両方 / 両方未指定は 400 VALIDATION_ERROR。',
      ].join('\n'),
    }),
  )

  const ExplorePostsResponse = registry.register(
    'ExplorePostsResponse',
    explorePostsResponseSchema.openapi({
      description: 'ハッシュタグ / ジャンル別投稿一覧レスポンス。feed と同等の投稿形式。',
    }),
  )

  registry.register(
    'BonsaiCareType',
    bonsaiCareTypeSchema.openapi({
      description: [
        '盆栽手入れ種別 enum（Prisma BonsaiCareType と一致）。',
        '値: pesticide / solid_fertilizer / liquid_fertilizer / rotate / shading / muro_in / muro_out / other',
      ].join('\n'),
    }),
  )

  registry.register(
    'CareLogItem',
    careLogItemSchema.openapi({ description: '手入れログ 1 件（id, type, performedAt, note）。' }),
  )

  const CareLogCreatedResponse = registry.register(
    'CareLogCreatedResponse',
    careLogCreatedResponseSchema.openapi({ description: '手入れログ作成成功レスポンス（id を返す）。' }),
  )

  const CareLogListResponse = registry.register(
    'CareLogListResponse',
    careLogListResponseSchema.openapi({ description: '手入れログ一覧レスポンス（カーソルページネーション）。' }),
  )

  const CreateCareLogRequest = registry.register(
    'CreateCareLogRequest',
    createCareLogRequestSchema.openapi({
      description: [
        '手入れログ作成リクエスト。type と performedAt は必須。',
        `note は最大 ${MAX_BONSAI_CARE_NOTE_LENGTH} 文字。`,
        '未来日（+1 日トレランス）は 400 VALIDATION_ERROR。',
      ].join('\n'),
    }),
  )

  const UpdateCareLogRequest = registry.register(
    'UpdateCareLogRequest',
    updateCareLogRequestSchema.openapi({
      description: [
        '手入れログ部分更新リクエスト。すべてのフィールドが optional。',
        'note に null を渡すとノートをクリアする。',
      ].join('\n'),
    }),
  )

  registry.register(
    'ListCareLogsQuery',
    listCareLogsQuerySchema.openapi({
      description: [
        'GET /api/v1/bonsai/care-logs クエリパラメータ。',
        `from / to 両方指定時は期間フィルタ（半開区間 [from, to)）。to - from が ${MAX_CARE_LOG_RANGE_DAYS} 日超は 400。`,
      ].join('\n'),
    }),
  )

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/summary',
    tags: ['analytics'],
    summary: '自分の投稿分析サマリを取得する',
    description: [
      '認証ユーザー自身の投稿・フォロワー・エンゲージメントのサマリを返す。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- プレミアム会員限定: 非プレミアムは 403 PREMIUM_REQUIRED',
      '- 自分のデータのみ（他ユーザーの分析は取得不可）',
      '- days: 7 / 30 / 90 の文字列のみ許容（省略時 30）',
      '- レート制限: analytics_summary（10/分）',
      '- posts.topPosts は期間内エンゲージメント（いいね＋コメント）上位 5 件',
      '- followers.growth の totalFollowers は推定累積値（新規数を積算）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        days: z
          .enum(['7', '30', '90'])
          .optional()
          .openapi({
            description: '集計期間（日）。7 / 30 / 90 のいずれか（省略時 30）',
          }),
      }),
    },
    responses: {
      200: {
        description: '分析サマリ取得成功',
        content: { 'application/json': { schema: AnalyticsSummaryResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  // ──────────────────────────────────────────────────
  // §D — 分析拡張エンドポイント パス登録（Wave 3 領域 D）
  // ──────────────────────────────────────────────────

  const analyticsCommonDescription = [
    '重要仕様:',
    '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
    '- プレミアム会員限定: 非プレミアムは 403 PREMIUM_REQUIRED',
    '- 自分のデータのみ（他ユーザーの分析は取得不可）',
    '- days: 7 / 30 / 90 の文字列のみ許容（省略時 30）',
    '- レート制限: analytics_summary（10/分）',
  ].join('\n')

  const analyticsDaysQuery = z.object({
    days: z
      .enum(['7', '30', '90'])
      .optional()
      .openapi({ description: '集計期間（日）。7 / 30 / 90 のいずれか（省略時 30）' }),
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/posts',
    tags: ['analytics'],
    summary: '期間内の投稿分析データを取得する',
    description: [
      '認証ユーザー自身の投稿統計（件数・いいね・コメント・上位投稿）を返す。',
      '',
      analyticsCommonDescription,
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: { query: analyticsDaysQuery },
    responses: {
      200: {
        description: '投稿分析データ取得成功',
        content: { 'application/json': { schema: AnalyticsPostsResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/likes',
    tags: ['analytics'],
    summary: '期間内のいいね分析データを取得する',
    description: [
      '認証ユーザーの投稿が受け取ったいいねの時間帯別・曜日別・日次分布を返す。',
      '',
      analyticsCommonDescription,
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: { query: analyticsDaysQuery },
    responses: {
      200: {
        description: 'いいね分析データ取得成功',
        content: { 'application/json': { schema: AnalyticsLikesResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/quotes',
    tags: ['analytics'],
    summary: '自分の投稿への引用・リポスト分析データを取得する（全期間）',
    description: [
      '認証ユーザーの投稿への引用数・リポスト数と、最新の引用一覧を返す。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- プレミアム会員限定: 非プレミアムは 403 PREMIUM_REQUIRED',
      '- days パラメータなし（全期間集計）',
      '- quotes は最大 ANALYTICS_POSTS_LIMIT = 50 件',
      '- レート制限: analytics_summary（10/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '引用・リポスト分析データ取得成功',
        content: { 'application/json': { schema: AnalyticsQuotesResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/keywords',
    tags: ['analytics'],
    summary: '期間内の投稿キーワード分析データを取得する',
    description: [
      '認証ユーザーの投稿本文からキーワードを抽出し、出現頻度上位を返す。',
      'ストップワード（助詞等）・2 文字未満の単語は除外される。',
      '',
      analyticsCommonDescription,
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: { query: analyticsDaysQuery },
    responses: {
      200: {
        description: 'キーワード分析データ取得成功',
        content: { 'application/json': { schema: AnalyticsKeywordsResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/engagement-trend',
    tags: ['analytics'],
    summary: '期間内の日次エンゲージメント推移を取得する',
    description: [
      '認証ユーザーの投稿の日次エンゲージメント（いいね＋コメント）推移を返す。',
      '投稿ゼロの日もエントリが存在する（posts/likes/comments/engagement = 0）。',
      '',
      analyticsCommonDescription,
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: { query: analyticsDaysQuery },
    responses: {
      200: {
        description: 'エンゲージメント推移データ取得成功',
        content: { 'application/json': { schema: AnalyticsEngagementTrendResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/genre-performance',
    tags: ['analytics'],
    summary: '期間内のジャンル別パフォーマンスを取得する',
    description: [
      '認証ユーザーの投稿をジャンル別に集計し、平均エンゲージメント降順で返す。',
      '注意: レスポンスに genreId は含まれない（name のみ）。',
      '',
      analyticsCommonDescription,
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: { query: analyticsDaysQuery },
    responses: {
      200: {
        description: 'ジャンル別パフォーマンスデータ取得成功',
        content: { 'application/json': { schema: AnalyticsGenrePerformanceResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/follower-growth',
    tags: ['analytics'],
    summary: '期間内のフォロワー増加推移を取得する',
    description: [
      '認証ユーザーの日次フォロワー増加数と累積フォロワー数の推移を返す。',
      'totalFollowers は推定累積値（新規数を積算）。currentFollowers は正確な現在値。',
      '',
      analyticsCommonDescription,
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: { query: analyticsDaysQuery },
    responses: {
      200: {
        description: 'フォロワー増加推移データ取得成功',
        content: { 'application/json': { schema: AnalyticsFollowerGrowthResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/analytics/period-comparison',
    tags: ['analytics'],
    summary: '現期間と前期間の比較データを取得する',
    description: [
      '直近 days 日（現期）とその前 days 日（前期）の投稿・いいね・コメント・フォロワー数を比較する。',
      'change は前期比変化率（%整数）。前期・現期ともに 0 の場合のみ null。',
      '',
      analyticsCommonDescription,
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: { query: analyticsDaysQuery },
    responses: {
      200: {
        description: '期間比較データ取得成功',
        content: { 'application/json': { schema: AnalyticsPeriodComparisonResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — days が不正な値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / プレミアム限定 (PREMIUM_REQUIRED)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §1.20 explore/posts パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/explore/posts',
    tags: ['explore'],
    summary: 'ハッシュタグ or ジャンル別の投稿一覧を取得する（ゲスト可）',
    description: [
      'hashtag または genreId のどちらか一方を指定して、該当する投稿一覧をカーソルページネーションで返す。',
      '',
      '重要仕様:',
      '- hashtag と genreId は排他（両方指定 / 両方未指定は 400 VALIDATION_ERROR）',
      '- hashtag は #なしのタグ名（例: "松"）。大小文字無視の部分一致',
      '- ブロック / ミュート / 非公開著者 / 停止著者の投稿は除外（feed と同一フィルタ）',
      '- isBlocked / isMuted / mentionedUsers は feed と同じ形式で付与',
      '- ゲスト可（Bearer 認証は必須だがゲストトークンで呼び出し可）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        hashtag: z.string().optional().openapi({
          description: 'ハッシュタグ名（# なし、例: "松"）。genreId と排他',
        }),
        genreId: z.string().optional().openapi({
          description: 'ジャンル ID。hashtag と排他',
        }),
        cursor: z.string().optional().openapi({
          description: '前回レスポンスの nextCursor 値',
        }),
        limit: z.number().int().min(1).max(100).optional().openapi({
          description: '取得件数（デフォルト 20、最大 100）',
        }),
      }),
    },
    responses: {
      200: {
        description: '投稿一覧取得成功',
        content: { 'application/json': { schema: ExplorePostsResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — hashtag/genreId 排他違反または形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §1.20 盆栽手入れログ パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/v1/bonsai/care-logs',
    tags: ['bonsai'],
    summary: '自分の手入れログ一覧を取得する（認証必須・ゲスト 403）',
    description: [
      '認証ユーザー自身の手入れログをカーソルページネーションで返す。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- from / to 両方指定で期間フィルタ（半開区間 [from, to)）',
      `- to - from が ${MAX_CARE_LOG_RANGE_DAYS} 日超の場合は 400 VALIDATION_ERROR`,
      '- from のみ / to のみは期間フィルタなしで全件取得',
      '- BonsaiCareLog は特定の盆栽に紐付かないユーザー全体のメモ（Web 仕様に準拠）',
      '- レート制限: read（60/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        from: z.string().optional().openapi({ description: '期間開始（ISO 8601、含む）' }),
        to: z.string().optional().openapi({ description: '期間終了（ISO 8601、含まない）' }),
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値' }),
        limit: z.number().int().min(1).max(100).optional().openapi({
          description: '取得件数（デフォルト 20、最大 100）',
        }),
      }),
    },
    responses: {
      200: {
        description: '手入れログ一覧取得成功',
        content: { 'application/json': { schema: CareLogListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 期間形式不正 / 期間超過'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/bonsai/care-logs',
    tags: ['bonsai'],
    summary: '手入れログを作成する（認証必須・ゲスト 403）',
    description: [
      '手入れログを作成する。type と performedAt は必須。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- performedAt の未来日（+1 日トレランス）は 400 VALIDATION_ERROR',
      `- note は最大 ${MAX_BONSAI_CARE_NOTE_LENGTH} 文字`,
      '- BonsaiCareLog は特定の盆栽に紐付かないユーザー全体のメモ',
      '- レート制限: care_log_write',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: CreateCareLogRequest } },
      },
    },
    responses: {
      201: {
        description: '手入れログ作成成功。id を返す',
        content: { 'application/json': { schema: CareLogCreatedResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 必須フィールド欠落 / 未来日 / note 超過'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/bonsai/care-logs/{logId}',
    tags: ['bonsai'],
    summary: '手入れログを部分更新する（所有者のみ）',
    description: [
      '自分の手入れログを部分更新する。省略したフィールドは現在値を維持する。',
      '',
      '重要仕様:',
      '- 所有者以外・不存在は 404 NOT_FOUND（ID 列挙攻撃防止）',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- note に null を渡すとノートをクリアする',
      '- レート制限: care_log_write',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ logId: z.string().openapi({ description: '手入れログ ID' }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: UpdateCareLogRequest } },
      },
    },
    responses: {
      200: {
        description: '手入れログ更新成功',
        content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 未来日 / note 超過'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('手入れログが見つからない (NOT_FOUND) — 不存在 / 他ユーザーのログ'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/bonsai/care-logs/{logId}',
    tags: ['bonsai'],
    summary: '手入れログを削除する（所有者のみ）',
    description: [
      '自分の手入れログを削除する。',
      '',
      '重要仕様:',
      '- 所有者以外・不存在は 404 NOT_FOUND（ID 列挙攻撃防止）',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- レート制限: delete_care_log',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ logId: z.string().openapi({ description: '手入れログ ID' }) }),
    },
    responses: {
      200: {
        description: '手入れログ削除成功',
        content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('手入れログが見つからない (NOT_FOUND) — 不存在 / 他ユーザーのログ'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  // ──────────────────────────────────────────────────
  // §1.21 確認メール再送 スキーマ登録 + パス登録
  // ──────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/verify-email/resend',
    tags: ['auth'],
    summary: '確認メールを再送する',
    description: [
      '列挙攻撃対策: メールアドレスの存在有無・確認済み・バリデーション失敗に関わらず常に 200 を返す。',
      'バリデーションエラーも 200 を返す（この仕様は意図的）。',
      '認証不要（未ログイン状態からも呼び出せる公開エンドポイント）。',
      '',
      'レート制限: verify_email_resend（IP ベース、1 時間 3 回、fail-closed）',
    ].join('\n'),
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: VerifyEmailResendRequest },
        },
      },
    },
    responses: {
      200: {
        description: 'リクエスト受付（メールアドレス存在有無・確認済みに関わらず常に 200）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §1.21 フォローリクエスト管理 スキーマ登録 + パス登録
  // ──────────────────────────────────────────────────

  const FollowRequestItem = registry.register(
    'FollowRequestItem',
    followRequestItemSchema.openapi({
      description: 'フォローリクエスト 1 件（リクエスト ID、作成日時、送信者情報）。',
    }),
  )

  const FollowRequestsListResponse = registry.register(
    'FollowRequestsListResponse',
    followRequestsListResponseSchema.openapi({
      description: '受信フォローリクエスト一覧（pending のみ）。カーソルページネーション形式。',
    }),
  )

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me/follow-requests',
    tags: ['follow'],
    summary: '受信フォローリクエスト一覧を取得する',
    description: [
      '自分宛ての pending フォローリクエスト一覧をカーソルページネーションで返す。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- pending 状態のリクエストのみ返す（承認/拒否済みは含まない）',
      '- 返却順: createdAt DESC、id DESC',
      '- レート制限: timeline（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値' }),
        limit: z.number().int().min(1).max(100).optional().openapi({ description: '取得件数（デフォルト 20、最大 100）' }),
      }),
    },
    responses: {
      200: {
        description: '受信フォローリクエスト一覧取得成功',
        content: { 'application/json': { schema: FollowRequestsListResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/users/me/follow-requests/{id}/approve',
    tags: ['follow'],
    summary: 'フォローリクエストを承認する',
    description: [
      '指定 ID のフォローリクエストを承認してフォロー関係を確立する。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 所有権チェック（自分宛てのリクエストのみ承認可）。他者のリクエスト / 不存在は 404',
      '- 承認完了後、リクエスト送信者に follow_request_approved 通知を送る',
      '- 既に承認/拒否済みの場合は 200 を返す（冪等）',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'フォローリクエスト ID' }) }),
    },
    responses: {
      200: {
        description: '承認成功（または既に処理済みで冪等成功）',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('リクエストが存在しないか自分宛てではない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/users/me/follow-requests/{id}/reject',
    tags: ['follow'],
    summary: 'フォローリクエストを拒否する',
    description: [
      '指定 ID のフォローリクエストを拒否してリクエストを削除する。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 所有権チェック（自分宛てのリクエストのみ拒否可）。他者のリクエスト / 不存在は 404',
      '- 拒否後は通知を送らない（Web 側と同一仕様）',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ description: 'フォローリクエスト ID' }) }),
    },
    responses: {
      200: {
        description: '拒否成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      404: errorResponse('リクエストが存在しないか自分宛てではない (NOT_FOUND)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // §1.21 通知設定 スキーマ登録 + パス登録
  // ──────────────────────────────────────────────────

  const NotificationPreferencesResponse = registry.register(
    'NotificationPreferencesResponse',
    notificationPreferencesResponseSchema.openapi({
      description: [
        'ユーザーが変更可能な通知設定。全キーは optional（未設定 = default true の意味）。',
        'system / subscription_expiring は重要なシステム通知のため含まれない（ユーザーが無効化不可）。',
      ].join('\n'),
    }),
  )

  const NotificationSettingsResponse = registry.register(
    'NotificationSettingsResponse',
    notificationSettingsResponseSchema.openapi({
      description: 'GET /api/v1/users/me/notification-settings の成功レスポンス。',
    }),
  )

  registry.registerPath({
    method: 'get',
    path: '/api/v1/users/me/notification-settings',
    tags: ['notifications'],
    summary: '通知設定を取得する',
    description: [
      '認証ユーザー自身の通知設定を返す。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 未設定キーは省略（デフォルト true と解釈すること）',
      '- system / subscription_expiring は含まれない（変更不可）',
      '- レート制限なし（read 相当）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: '通知設定取得成功',
        content: { 'application/json': { schema: NotificationSettingsResponse } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
    },
  })

  registry.registerPath({
    method: 'patch',
    path: '/api/v1/users/me/notification-settings',
    tags: ['notifications'],
    summary: '通知設定を部分更新する',
    description: [
      '通知設定を部分更新する。送信したキーのみ更新される。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- system / subscription_expiring キーは受け付けない（400 VALIDATION_ERROR）',
      '- 省略したキーは現在値を維持する',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: NotificationPreferencesResponse },
        },
      },
    },
    responses: {
      200: {
        description: '通知設定更新成功',
        content: { 'application/json': { schema: SuccessResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — 不正なキー / 値'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
    },
  })

  // ──────────────────────────────────────────────────
  // Wave 4 領域 F — ダイレクトメッセージ (DM) スキーマ登録
  // ──────────────────────────────────────────────────

  registry.register(
    'DmLastMessage',
    dmLastMessageSchema.openapi({
      description: '会話一覧の最終メッセージサマリ。senderId で自分/相手を区別できる。',
    }),
  )

  const ConversationItem = registry.register(
    'ConversationItem',
    conversationItemSchema.openapi({
      description: '会話一覧の 1 件。otherUser は id / nickname / avatarUrl の最小情報。',
    }),
  )

  const ConversationListResponse = registry.register(
    'ConversationListResponse',
    conversationListResponseSchema.openapi({
      description: '会話一覧レスポンス（カーソルページネーション）。',
    }),
  )

  const StartConversationResponse = registry.register(
    'StartConversationResponse',
    startConversationResponseSchema.openapi({
      description: '会話開始（取得/新規作成）の成功レスポンス。',
    }),
  )

  const MessageItem = registry.register(
    'MessageItem',
    messageItemSchema.openapi({
      description: 'メッセージ 1 件。sender は id / nickname / avatarUrl の最小情報。',
    }),
  )

  const MessageListResponse = registry.register(
    'MessageListResponse',
    messageListResponseSchema.openapi({
      description: [
        'メッセージ一覧レスポンス（カーソルページネーション）。',
        'items は createdAt 昇順（古い→新しい）。',
        'nextCursor は最古メッセージの id で、次回呼び出しでより古いメッセージを取得できる。',
        'GET するたびに lastReadAt が更新される（ポーリング前提）。',
      ].join('\n'),
    }),
  )

  const StartConversationRequest = registry.register(
    'StartConversationRequest',
    startConversationRequestSchema.openapi({
      description: '会話開始リクエスト。targetUserId は相手のユーザー ID。',
    }),
  )

  const SendMessageRequest = registry.register(
    'SendMessageRequest',
    sendMessageRequestSchema.openapi({
      description: `メッセージ送信リクエスト。content は必須・非空・最大 ${MAX_MESSAGE_LENGTH} 文字。`,
    }),
  )

  // DM パス登録

  registry.registerPath({
    method: 'get',
    path: '/api/v1/messages/conversations',
    tags: ['messages'],
    summary: '自分の会話一覧を取得する',
    description: [
      '認証ユーザーが参加しているすべての会話を updatedAt 降順で返す。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 相手ユーザー・最終メッセージ・未読フラグを 1 クエリで取得（N+1 なし）',
      '- レート制限: read（60/分）',
      '- ポーリング前提: リアルタイム通信なし。推奨ポーリング間隔は 5〜30 秒',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値' }),
        limit: z.number().int().min(1).max(100).optional().openapi({
          description: '取得件数（デフォルト 20、最大 100）',
        }),
      }),
    },
    responses: {
      200: {
        description: '会話一覧取得成功',
        content: { 'application/json': { schema: ConversationListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — limit / cursor 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) またはゲスト不可 (GUEST_NOT_ALLOWED)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/messages/conversations',
    tags: ['messages'],
    summary: '会話を開始する（取得または新規作成）',
    description: [
      '指定ユーザーとの会話を取得、なければ新規作成する。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 自己 DM は 400 VALIDATION_ERROR',
      '- ブロック関係（双方向）は 403 NOT_FOUND（存在を秘匿）',
      '- 対象ユーザーが停止・存在しない場合は 404 NOT_FOUND',
      '- 既存会話がある場合は作成せずその id を返す（冪等）',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: StartConversationRequest } },
      },
    },
    responses: {
      200: {
        description: '会話取得/作成成功',
        content: { 'application/json': { schema: StartConversationResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — targetUserId 欠落 / 自己 DM'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / ブロック関係 (NOT_FOUND)'),
      404: errorResponse('対象ユーザーが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/v1/messages/conversations/{id}/messages',
    tags: ['messages'],
    summary: '会話のメッセージ一覧を取得する',
    description: [
      '指定会話のメッセージをカーソルページネーションで返す（参加者のみ）。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 非参加者は 403 NOT_FOUND（存在を秘匿）',
      '- items は createdAt 昇順（古い→新しい）',
      '- nextCursor は最古メッセージの id。次回呼び出しでより古いメッセージを取得できる（無限スクロール上向き）',
      '- GET するたびに lastReadAt が更新される（既読自動化）',
      '- デフォルト limit は 50（MESSAGES_PAGE_LIMIT）',
      '- レート制限: read（60/分）',
      '- ポーリング前提: 推奨間隔は 3〜10 秒',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '会話 ID' }),
      }),
      query: z.object({
        cursor: z.string().optional().openapi({ description: '前回レスポンスの nextCursor 値（最古メッセージ id）' }),
        limit: z.number().int().min(1).max(100).optional().openapi({
          description: '取得件数（デフォルト 50、最大 100）',
        }),
      }),
    },
    responses: {
      200: {
        description: 'メッセージ一覧取得成功',
        content: { 'application/json': { schema: MessageListResponse } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — limit / cursor 形式不正'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 非参加者 (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/messages/conversations/{id}/messages',
    tags: ['messages'],
    summary: 'メッセージを送信する',
    description: [
      '指定会話にメッセージを送信する（参加者のみ）。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 非参加者は 403 NOT_FOUND（存在を秘匿）',
      `- content は必須・非空・最大 ${MAX_MESSAGE_LENGTH} 文字`,
      '- 日次送信上限 100 通（DAILY_MESSAGE_LIMIT）を超えると 400 VALIDATION_ERROR',
      '- 会話作成後にブロックが発生していた場合は 403 NOT_FOUND',
      '- レート制限: send_message（20/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '会話 ID' }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: SendMessageRequest } },
      },
    },
    responses: {
      201: {
        description: 'メッセージ送信成功',
        content: { 'application/json': { schema: MessageItem } },
      },
      400: errorResponse('バリデーションエラー (VALIDATION_ERROR) — content 欠落 / 空 / 文字数超過 / 日次上限'),
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 非参加者またはブロック (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/api/v1/messages/conversations/{id}/messages/{messageId}',
    tags: ['messages'],
    summary: 'メッセージを削除する（送信者のみ）',
    description: [
      '自分が送信したメッセージを削除する。他人のメッセージは削除不可。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 不存在のメッセージは 404 NOT_FOUND',
      '- 他人のメッセージは 403 NOT_FOUND（存在を秘匿）',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '会話 ID' }),
        messageId: z.string().openapi({ description: 'メッセージ ID' }),
      }),
    },
    responses: {
      200: {
        description: 'メッセージ削除成功',
        content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 他人のメッセージ (NOT_FOUND)'),
      404: errorResponse('メッセージが存在しない (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/api/v1/messages/conversations/{id}/read',
    tags: ['messages'],
    summary: '会話を既読にする',
    description: [
      '会話の lastReadAt を現在時刻に更新して既読化する（参加者のみ）。',
      '',
      '重要仕様:',
      '- Bearer 必須・ゲストアカウントは 403 GUEST_NOT_ALLOWED',
      '- 非参加者は 403 NOT_FOUND（存在を秘匿）',
      '- GET /api/v1/messages/conversations/{id}/messages でも自動的に既読化される',
      '- レート制限: engagement（30/分）',
    ].join('\n'),
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ description: '会話 ID' }),
      }),
    },
    responses: {
      200: {
        description: '既読化成功',
        content: { 'application/json': { schema: z.object({ success: z.literal(true) }) } },
      },
      401: errorResponse('Bearer トークンなし (AUTH_REQUIRED) または期限切れ (AUTH_TOKEN_EXPIRED)'),
      403: errorResponse('アカウント停止 (ACCOUNT_SUSPENDED) / ゲスト不可 (GUEST_NOT_ALLOWED) / 非参加者 (NOT_FOUND)'),
      429: rateLimitedResponse,
      500: errorResponse('内部エラー (INTERNAL_ERROR)'),
    },
  })

  // ──────────────────────────────────────────────────
  // ドキュメント生成 + 出力
  // ──────────────────────────────────────────────────

  const generator = new OpenApiGeneratorV31(registry.definitions)

  const document = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Bon_Log Mobile API',
      version: '1.25.0',
      description: [
        '盆栽 SNS「Bon_Log」のモバイルアプリ向け API。',
        '',
        '## 認証フロー',
        '',
        '1. POST /api/v1/auth/login でトークンペアを取得',
        '2. API リクエストに Authorization: Bearer <accessToken> を付与',
        '3. 401 AUTH_TOKEN_EXPIRED を受け取ったら POST /api/v1/auth/refresh でペアを更新',
        '4. 401 AUTH_REFRESH_TOKEN_REUSE_DETECTED はセキュリティ警告画面を表示して再ログインを促す',
        '',
        '## レート制限',
        '',
        '429 レスポンスには Retry-After ヘッダー（秒）が付与される。自動リトライは禁止。',
      ].join('\n'),
    },
    servers: [{ url: 'https://www.bon-log.com', description: '本番サーバー' }],
  })

  const outPath = path.join(scriptDir, '..', 'openapi', 'openapi.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  // JSON.stringify のキー順は挿入順が保証されるため、再実行で diff ゼロを実現できる
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n', 'utf-8')

  console.log(`OpenAPI spec generated: ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
