/**
 * ストレージ削除 outbox（`StorageDeletionJob`）関連の制限値。
 *
 * @module lib/constants/limits/storage-deletion
 */

/** cron 1 回の実行で処理するジョブの最大件数（無制限スキャン防止）。 */
export const STORAGE_DELETION_BATCH_SIZE = 50

/**
 * リトライ上限回数。この回数だけ試行しても失敗が続いた場合は dead_letter へ遷移し
 * 自動リトライを止める（サイレントに握り潰さず、手動再実行を待つ）。
 */
export const STORAGE_DELETION_MAX_ATTEMPTS = 8

/** 指数バックオフの基準間隔（分）。1 回目の失敗後の待機時間。 */
export const STORAGE_DELETION_BACKOFF_BASE_MINUTES = 5

/**
 * 指数バックオフの上限（分・4時間）。
 * `BASE * 2^(attemptCount-1)` の計算値がこれを超えたら頭打ちにする。
 */
export const STORAGE_DELETION_BACKOFF_MAX_MINUTES = 240

/**
 * `processing` のまま更新が止まったジョブを stale とみなし `pending` に戻すまでの時間（分）。
 * cron のプロセスクラッシュ・タイムアウトで永久に processing のまま残ることを防ぐ。
 */
export const STORAGE_DELETION_STALE_LOCK_MINUTES = 15

/** 完了済み（completed）ジョブを保持する期間（日）。経過後は cron が削除する。 */
export const STORAGE_DELETION_COMPLETED_RETENTION_DAYS = 30

/**
 * アカウント削除トランザクション（`account-deletion-service.ts`）の timeout（ミリ秒）。
 * メディア点数が多いユーザーでは既定の 5 秒を超えるリスクがあるため明示的に延長する。
 */
export const ACCOUNT_DELETION_TRANSACTION_TIMEOUT_MS = 30000
