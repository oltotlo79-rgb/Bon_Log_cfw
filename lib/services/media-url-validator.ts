/**
 * @module lib/services/media-url-validator
 *
 * v1 経路専用: mediaUrls が自社ストレージ（R2 / local / supabase）由来であることを検証する。
 * Web 側（lib/actions/）は使用しない。正規アップロードフローは必ず自社ストレージ URL を返すため、
 * 外部 URL を拒否しても正常クライアントに影響しない。
 *
 * 防御対象:
 *   - 任意 URL 埋め込みによる閲覧者 IP 漏洩（サードパーティ追跡ピクセル等）
 *   - 外部不正コンテンツを自社プラットフォーム経由で配信する攻撃
 */

import { getAllowedStorageOrigins } from '@/lib/storage/allowed-origins'

/**
 * 各 URL が自社ストレージのプレフィックスで始まるかを検証する。
 *
 * @param urls 検証対象の mediaUrls（空配列は常に true）
 * @returns 全 URL が許可プレフィックスで始まれば true、1 つでも違反があれば false
 *
 * 許可プレフィックスが 1 件も取得できない場合（環境変数未設定等）は
 * 検証をスキップして true を返す（設定漏れで正規フローを壊さないため）。
 * 本番では必ず STORAGE_PROVIDER と対応する env が設定される前提。
 */
export function assertMediaUrlsFromOwnStorage(urls: readonly string[]): boolean {
  if (urls.length === 0) return true

  const allowedOrigins = getAllowedStorageOrigins()
  // 環境変数未設定でプレフィックスが不明な場合は検証不能なためスキップする。
  if (allowedOrigins.length === 0) return true

  return urls.every((url) => allowedOrigins.some((origin) => url.startsWith(origin)))
}

/**
 * 自社ストレージ由来の URL だけを残して返す（all-or-nothing ではなく個別フィルタ）。
 *
 * Why: アカウント削除時のストレージ削除 outbox（`StorageDeletionJob`）は、DB に保存された
 * 任意の URL を無条件に削除対象へ入れると、不正な値が紛れ込んだ場合に外部ホストへ
 * DELETE 相当の副作用（ストレージアダプタの解釈次第だが SSRF 的懸念を含む）を及ぼしうる。
 * 1 件でも不許可なら全体を捨てる `assertMediaUrlsFromOwnStorage` と異なり、こちらは
 * 不正な URL だけを黙って除外し、正当な URL の削除は継続させる。
 *
 * 許可プレフィックスが 1 件も取得できない場合（環境変数未設定等）は
 * 検証をスキップして全件を返す（設定漏れで正規フローを壊さないため、既存関数と同方針）。
 */
export function filterOwnStorageUrls(urls: readonly string[]): string[] {
  const allowedOrigins = getAllowedStorageOrigins()
  if (allowedOrigins.length === 0) return [...urls]

  return urls.filter((url) => allowedOrigins.some((origin) => url.startsWith(origin)))
}
