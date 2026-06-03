/**
 * メディア・ファイル関連の制限値
 *
 * @module lib/constants/limits/media
 */

/** 画像の最大サイズ（MB）。UI 表示文言もこの値から生成する。 */
export const MAX_IMAGE_SIZE_MB = 4

/** 画像の最大サイズ（バイト） */
export const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024

/** 動画の最大サイズ（256MB） */
export const MAX_VIDEO_SIZE = 256 * 1024 * 1024

/** 無料プラン: 投稿に添付可能な画像の最大枚数 */
export const MAX_POST_IMAGES_FREE = 4

/** 無料プラン: 投稿に添付可能な動画の最大本数 */
export const MAX_POST_VIDEOS_FREE = 1

/** コメントに添付可能なメディアの最大数 */
export const MAX_COMMENT_MEDIA = 3

/** 盆栽記録の画像最大枚数 */
export const MAX_BONSAI_RECORD_IMAGES = 4

/** レビュー画像の最大枚数 */
export const MAX_REVIEW_IMAGES = 3

/** レビュー画像の最大サイズ（4MB） */
export const MAX_REVIEW_IMAGE_SIZE = 4 * 1024 * 1024

/** コメントに添付可能な画像の最大枚数 */
export const MAX_COMMENT_IMAGES = 2

/** コメントに添付可能な動画の最大本数 */
export const MAX_COMMENT_VIDEOS = 1

/** 圧縮前の画像最大サイズ（10MB） */
export const MAX_IMAGE_SIZE_BEFORE_COMPRESSION = 10 * 1024 * 1024

/** 圧縮スキップのしきい値（500KB） */
export const SKIP_COMPRESSION_THRESHOLD = 500 * 1024

/** 画像の最大幅または高さ（px） */
export const MAX_IMAGE_DIMENSION = 1920

/** デフォルト画像品質 */
export const DEFAULT_IMAGE_QUALITY = 0.8

/** 圧縮リトライ時の品質低減係数 */
export const COMPRESSION_QUALITY_FACTOR = 0.7

/** 圧縮リトライの最大回数 */
export const MAX_COMPRESSION_RETRIES = 3

/** デフォルト圧縮最大サイズ（MB） */
export const DEFAULT_COMPRESSION_MAX_SIZE_MB = 1

/** アバター圧縮最大サイズ（MB） */
export const AVATAR_COMPRESSION_MAX_SIZE_MB = 0.5

/** アバター最大解像度（px） */
export const AVATAR_MAX_DIMENSION = 512

/** ヘッダー圧縮最大サイズ（MB） */
export const HEADER_COMPRESSION_MAX_SIZE_MB = 1

/** ヘッダー最大解像度（px） */
export const HEADER_MAX_DIMENSION = 1500

/** ヘッダー画像の推奨表示サイズ（px）。UI の推奨サイズ文言の単一ソース。 */
export const HEADER_RECOMMENDED_WIDTH = 1500
export const HEADER_RECOMMENDED_HEIGHT = 500

/** プロフィール画像に許可されるMIMEタイプ */
export const ALLOWED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Presigned upload で許可する MIME タイプ。
 * 現状は動画のみ (画像は Server Action 経由)。Zod enum として使う。
 */
export const ALLOWED_UPLOAD_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const
export type AllowedUploadVideoType = (typeof ALLOWED_UPLOAD_VIDEO_TYPES)[number]

/**
 * Presigned upload で許可する保存先フォルダ。
 * R2 key の prefix としてそのまま使われるため、path traversal 防止に enum で固定する。
 */
export const ALLOWED_UPLOAD_FOLDERS = ['posts', 'post-videos', 'avatars', 'headers'] as const
export type AllowedUploadFolder = (typeof ALLOWED_UPLOAD_FOLDERS)[number]

/** MIME タイプ → 保存時拡張子 (presigned upload のキー生成用)。 */
export const UPLOAD_MIME_EXTENSION_MAP: Record<AllowedUploadVideoType, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
}

/** OG画像の幅（px） */
export const OG_IMAGE_WIDTH = 1200

/** OG画像の高さ（px） */
export const OG_IMAGE_HEIGHT = 630

/** RIFFヘッダーサイズ（バイト） */
export const RIFF_HEADER_SIZE = 12
