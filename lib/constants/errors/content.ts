/**
 * 投稿・コメント・メディア・バリデーション関連のエラーメッセージ
 *
 * @module lib/constants/errors/content
 */

import { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } from '@/lib/constants/limits'

/** レート制限超過時のエラー（汎用操作） */
export const ERR_RATE_LIMIT_OPERATION = '操作が多すぎます。しばらく待ってから再試行してください'

/** レート制限超過時のエラー（アップロード） */
export const ERR_RATE_LIMIT_UPLOAD = 'アップロードが多すぎます。しばらく待ってから再試行してください'

/** レート制限超過時のエラー（読み取り） */
export const ERR_RATE_LIMIT_READ = 'リクエストが多すぎます'

/** コンテンツ不足エラー（投稿/予約投稿） */
export const ERR_CONTENT_REQUIRED = 'テキストまたはメディアを入力してください'

/** コンテンツ不足エラー（コメント） */
export const ERR_COMMENT_CONTENT_REQUIRED = 'コメント内容またはメディアを入力してください'

/** ファイル未選択エラー */
export const ERR_FILE_NOT_SELECTED = 'ファイルが選択されていません'

/** 画像サイズ超過エラー */
export const ERR_IMAGE_SIZE_EXCEEDED = `画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください`

/** 動画サイズ超過エラー */
export const ERR_VIDEO_SIZE_EXCEEDED = `動画は${MAX_VIDEO_SIZE / 1024 / 1024}MB以下にしてください`

/** 画像形式エラー */
export const ERR_INVALID_IMAGE_FORMAT = 'JPEG、PNG、WebP形式のみ対応しています'

/** 画像または動画選択エラー */
export const ERR_IMAGE_VIDEO_SELECT = '画像または動画ファイルを選択してください'

/** メディアデータ不正エラー */
export const ERR_MEDIA_DATA_INVALID = 'メディアデータが不正です'

/** バリデーションエラー */
export const ERR_INVALID_INPUT = '入力データが不正です'

/** 操作失敗エラー */
export const ERR_POST_CREATE_FAILED = '投稿の作成に失敗しました'
export const ERR_POST_UPDATE_FAILED = '投稿の更新に失敗しました'
export const ERR_POST_NOT_EDITABLE = 'この投稿は編集できません'
export const ERR_POST_DELETE_FAILED = '投稿の削除に失敗しました'
export const ERR_REPOST_FAILED = 'リポストに失敗しました'
export const ERR_QUOTE_REQUIRED = '引用コメントを入力してください'
export const ERR_UPLOAD_FAILED = 'アップロードに失敗しました'
export const ERR_UPLOAD_SERVER_ERROR = 'アップロード中にエラーが発生しました。しばらく経ってから再試行してください'
export const ERR_MEDIA_UPLOAD_FAILED = 'メディアのアップロードに失敗しました'
export const ERR_UPLOAD_INVALID_FOLDER = '無効なフォルダです'
export const ERR_UPLOAD_PARAMS_REQUIRED = 'contentType と fileSize が必要です'
export const ERR_UPLOAD_FORMAT_NOT_ALLOWED = '許可されていないファイル形式です'
export const ERR_STORAGE_NOT_CONFIGURED = 'ストレージが設定されていません'
export const ERR_PRESIGNED_URL_FAILED = '署名付きURLの生成に失敗しました'
export const ERR_COMMENT_CREATE_FAILED = 'コメントの作成に失敗しました'
export const ERR_COMMENT_DELETE_FAILED = 'コメントの削除に失敗しました'
export const ERR_COMMENT_UPDATE_FAILED = 'コメントの更新に失敗しました'

/** 投稿非表示 */
export const ERR_CANNOT_HIDE_OWN_POST = '自分の投稿は非表示にできません'
export const ERR_HIDE_POST_FAILED = '非表示に失敗しました'

/** 文字数超過エラー（テンプレート） */
export const ERR_CONTENT_TOO_LONG = (max: number) => `${max}文字以内で入力してください`
export const ERR_POST_CONTENT_TOO_LONG = (max: number) => `投稿は${max}文字以内で入力してください`
export const ERR_COMMENT_CONTENT_TOO_LONG = (max: number) => `コメントは${max}文字以内で入力してください`

/** 日次制限超過エラー（テンプレート） */
export const ERR_DAILY_POST_LIMIT = (limit: number) => `1日の投稿上限（${limit}件）に達しました`
export const ERR_DAILY_COMMENT_LIMIT = (limit: number) => `1日のコメント上限（${limit}件）に達しました`
export const ERR_DAILY_UPLOAD_LIMIT = (limit: number) => `1日のアップロード上限（${limit}回）に達しました`

/** メディア・投稿バリデーション（テンプレート） */
export const ERR_IMAGE_LIMIT = (max: number) => `画像は${max}枚までです`
export const ERR_VIDEO_LIMIT = (max: number) => `動画は${max}本までです`
/** 動画投稿がプレミアム会員限定の場合に表示するエラー（maxVideos === 0 のとき） */
export const ERR_VIDEO_PREMIUM_ONLY = '動画の投稿はプレミアム会員限定です'
export const ERR_GENRE_LIMIT = (max: number) => `ジャンルは${max}つまで選択できます`

/** 汎用操作失敗エラー */
export const ERR_OPERATION_FAILED = '操作に失敗しました'

/** 汎用バリデーション補足メッセージ（Zodフォールバック用） */
export const ERR_INPUT_INVALID_GENERIC = '入力内容を確認してください'

/** プロフィール・ユーザー関連フィールドのバリデーション（テンプレート含む） */
export const ERR_NICKNAME_REQUIRED = 'ニックネームを入力してください'
export const ERR_NICKNAME_TOO_LONG = (max: number) => `ニックネームは${max}文字以内で入力してください`
export const ERR_NICKNAME_INVALID_CHARS = 'ニックネームに改行や < > は使えません'
export const ERR_BIO_TOO_LONG = (max: number) => `自己紹介は${max}文字以内で入力してください`
export const ERR_LOCATION_TOO_LONG = (max: number) => `居住地域は${max}文字以内で入力してください`
export const ERR_BONSAI_START_YEAR_INVALID = '盆栽歴の年は有効な年を指定してください'
export const ERR_BONSAI_START_MONTH_INVALID = '盆栽歴の月は1〜12の整数で指定してください'
export const ERR_BIRTH_DATE_INVALID = '誕生日の形式が正しくありません'

/** 認証フォーム（登録）のバリデーション */
export const ERR_EMAIL_INVALID = '有効なメールアドレスを入力してください'
export const ERR_EMAIL_TOO_LONG = (max: number) => `メールアドレスは${max}文字以内で入力してください`

/** ファイル検証（file-validation.ts 用の詳細エラー） */
export const ERR_FILE_FORMAT_NOT_ALLOWED = (allowedTypes: readonly string[]) =>
  `許可されていないファイル形式です。対応形式: ${allowedTypes.join(', ')}`
export const ERR_FILE_FORMAT_UNDETECTABLE_IMAGE =
  'ファイル形式を識別できません。有効な画像ファイルを選択してください'
export const ERR_FILE_ACTUAL_FORMAT_NOT_ALLOWED = (detectedType: string) =>
  `ファイルの実際の形式（${detectedType}）は許可されていません`
export const ERR_VIDEO_FILE_REQUIRED = '動画ファイルを選択してください'
export const ERR_FILE_FORMAT_UNDETECTABLE_VIDEO =
  'ファイル形式を識別できません。有効な動画ファイルを選択してください'
export const ERR_NOT_VALID_VIDEO = 'このファイルは有効な動画ファイルではありません'
export const ERR_VIDEO_FORMAT_NOT_SUPPORTED = (
  detectedType: string,
  allowedTypes: readonly string[],
) => `動画形式（${detectedType}）は対応していません。対応形式: ${allowedTypes.join(', ')}`
export const ERR_INVALID_IMAGE_GENERIC = '無効な画像ファイルです'
