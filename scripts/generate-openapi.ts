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
    registerRequestSchema,
    createReportRequestSchema,
    createPostRequestSchema,
    updatePostRequestSchema,
    createCommentRequestSchema,
    presignedUploadRequestSchema,
    updateProfileRequestSchema,
    registerDeviceRequestSchema,
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
        'bonsai 紐付け・アンケートはモバイル MVP 外（将来別途追加）。',
      ].join('\n'),
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
    path: '/api/v1/search/posts',
    tags: ['search'],
    summary: '投稿検索',
    description: [
      'キーワードで投稿を全文検索する。',
      '',
      '2 文字以上: pg_bigm trigram 検索。1 文字: LIKE フォールバック。',
      'ブロック・ミュート・非公開・停止ユーザーの投稿は除外される。',
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
      description: 'GET /api/v1/fertilizers/tree-species/{slug}/schedule 成功レスポンス。months は月順で最大 12 件。',
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
  // ドキュメント生成 + 出力
  // ──────────────────────────────────────────────────

  const generator = new OpenApiGeneratorV31(registry.definitions)

  const document = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Bon_Log Mobile API',
      version: '1.13.0',
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
