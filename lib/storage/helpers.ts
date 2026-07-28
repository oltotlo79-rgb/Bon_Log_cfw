/**
 * @module lib/storage/helpers
 *
 * ストレージ抽象化レイヤー共通ヘルパー (拡張子推定・エラー整形)。
 */

/**
 * ストレージ操作のエラーからユーザー向けメッセージを生成する。
 * 本番では詳細を隠蔽し fallback を返し、非本番では原文を返してデバッグに使う。
 */
export function getStorageErrorMessage(err: unknown, fallbackMessage: string): string {
  if (!(err instanceof Error)) return 'Unknown error'
  if (process.env.NODE_ENV !== 'production') return err.message
  return fallbackMessage
}

/**
 * Content-Type (MIME) と R2 上の保存拡張子のマッピング。
 *
 * Why: `/api/upload` は image + video を受けるため、video MIME を含めないと
 * `getExtension()` の fallback で video が `.jpg` として保存され、CDN 配信時に
 * 動画として扱われなくなる。`lib/file-validation.ts` の signature 検証で
 * 許可している MIME と同じ範囲をここでも明示する。
 */
const CONTENT_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  // image
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  // video — file-validation.ts と一致させる
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
}

/** 未知 MIME 用 fallback。アップロードの大半は jpeg のため image で fallback する。 */
const UNKNOWN_CONTENT_TYPE_FALLBACK = '.jpg'

/** Content-Type から R2 保存用の拡張子を返す。未知 MIME は image/jpeg にフォールバックする。 */
export function getExtension(contentType: string): string {
  return CONTENT_TYPE_EXTENSIONS[contentType] ?? UNKNOWN_CONTENT_TYPE_FALLBACK
}

/** Node.js の `fs` 系エラー（`code` プロパティを持つ Error）かどうかを絞り込む型ガード。 */
export function isNodeErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}
