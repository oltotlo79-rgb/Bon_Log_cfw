/**
 * ユーザー入力のサニタイズ関数群（XSS・SQLi 補助対策）。
 *
 * DOMPurify は Vercel のサーバーレス環境で不安定なため、用途別に正規表現ベースで実装している。
 * DB 層の SQLi 一次防御は Prisma のパラメータ化クエリ。ここはあくまで多層防御の一部。
 *
 * @module lib/sanitize
 */

/**
 * `<script>` `<style>` を中身ごと、それ以外のタグを剥がす。
 * script/style は中身がアクティブコンテンツになるためタグ単独削除では不十分。
 */
function stripHtmlTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
}

/** 主要な HTML エンティティを元の文字に戻す。 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * HTML 特殊文字をエンティティにエスケープする。
 * `&` を最初に処理すること（後回しにすると `&lt;` が `&amp;lt;` に壊れる）。
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * 表示用の一般テキストサニタイズ。
 * タグ除去 → エンティティ正規化 → 再エスケープ、で既存エンティティも取り違えずに扱える。
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''
  const stripped = stripHtmlTags(input)
  const decoded = decodeHtmlEntities(stripped)
  return escapeHtml(decoded)
}

/**
 * リッチテキスト入力向けのサニタイズ。
 * 現状はサーバー側で全タグ除去する保守的な実装。ホワイトリスト許可が必要になったらここで導入する。
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''
  return stripHtmlTags(input)
}

/**
 * URL 入力の検証＋無害化。
 * `javascript:` / `data:` / `file:` を弾き、相対パス（`/xxx`）のみ許可する
 * （`//evil.com` のプロトコル相対 URL は拒否）。
 */
export function sanitizeUrl(input: string | null | undefined): string {
  if (!input) return ''

  const trimmed = input.trim()
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']

  try {
    const url = new URL(trimmed)
    if (!allowedProtocols.includes(url.protocol)) {
      return ''
    }
    return url.href
  } catch {
    // URL コンストラクタは絶対 URL のみ受け付けるので相対パスを手動で許可する
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed
    }
    return ''
  }
}

/**
 * ニックネーム用のサニタイズ。
 * タグ除去に加えて、制御文字（改行・タブを含む 0x00–0x1F, 0x7F）もすべて削除する。
 */
export function sanitizeNickname(input: string | null | undefined): string {
  if (!input) return ''
  const withoutHtml = stripHtmlTags(input)
  const withoutControl = withoutHtml.replace(/[\x00-\x1F\x7F]/g, '')
  return withoutControl.trim()
}

/**
 * 検索クエリ用のサニタイズ（Prisma のパラメータ化に対する多層防御）。
 * セミコロン・バックスラッシュ・SQL コメント（`--`）を念のため除去する。
 */
export function sanitizeSearchQuery(input: string | null | undefined): string {
  if (!input) return ''

  const withoutHtml = stripHtmlTags(input)

  const sanitized = withoutHtml
    .replace(/[;\\]/g, '')
    .replace(/--/g, '')
    .trim()

  return sanitized
}

/**
 * ファイル名のサニタイズ。
 * パストラバーサル（`..`）や隠しファイル化（先頭ドット）、OS で禁止された文字を落とす。
 * 空になったら `'file'` にフォールバック。
 */
export function sanitizeFilename(input: string | null | undefined): string {
  if (!input) return 'file'

  const sanitized = input
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\.\./g, '')
    .replace(/^\.+/, '')
    .trim()

  return sanitized || 'file'
}

/**
 * 投稿本文のサニタイズ。
 * タグ除去＋3 連以上の改行を 2 連に圧縮（スパム対策・表示崩れ防止）。
 */
export function sanitizePostContent(input: string | null | undefined): string {
  if (!input) return ''
  const withoutHtml = stripHtmlTags(input)
  const normalizedNewlines = withoutHtml.replace(/\n{3,}/g, '\n\n')
  return normalizedNewlines.trim()
}

/**
 * メッセージ本文のサニタイズ。投稿と同ルール。
 * メッセージ固有のルールが必要になったらここで分岐する。
 */
export function sanitizeMessageContent(input: string | null | undefined): string {
  return sanitizePostContent(input)
}

/**
 * 保存用の汎用サニタイズ（表示前の escapeHtml は含まない）。
 * 改行・タブは保持しつつ、その他の制御文字を落とす。
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return ''
  const withoutHtml = stripHtmlTags(input)
  // 改行(\x0A)・CR(\x0D)・水平タブ(\x09)は保持し、それ以外の制御文字のみ除去
  const withoutControl = withoutHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return withoutControl.trim()
}
