/**
 * @module lib/storage/index
 *
 * ストレージ抽象化レイヤーの barrel。`STORAGE_PROVIDER` (環境変数) で
 * local / supabase / r2 を切り替える Strategy パターン。公開 API は
 * `uploadFile` / `deleteFile` の 2 関数と `UploadResult` / `DeleteResult` 型のみ。
 */

import type { StorageProvider, UploadResult, DeleteResult } from './types'
import { LocalStorageProvider } from './local-provider'
import { SupabaseStorageProvider } from './supabase-provider'
import { CloudflareR2StorageProvider } from './r2-provider'

export type { UploadResult, DeleteResult } from './types'

// プロセス内シングルトン。プロバイダー初期化コスト (R2 の SDK ロード等) を避ける。
let storageProvider: StorageProvider | null = null

function getStorageProvider(): StorageProvider {
  if (storageProvider) return storageProvider
  const provider = process.env.STORAGE_PROVIDER || 'local'
  switch (provider) {
    case 'supabase':
      storageProvider = new SupabaseStorageProvider()
      break
    case 'r2':
      storageProvider = new CloudflareR2StorageProvider()
      break
    case 'local':
    default:
      // 未知値は local にフォールバック (デプロイ設定漏れでアプリが落ちないように)。
      storageProvider = new LocalStorageProvider()
      break
  }
  return storageProvider
}

/** 設定されたプロバイダーへファイルをアップロードする。呼び出し側はプロバイダー差を意識しない。 */
export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string,
  folder: string
): Promise<UploadResult> {
  const provider = getStorageProvider()
  return provider.upload(file, filename, contentType, folder)
}

/** 設定されたプロバイダーからファイルを削除する。URL 形式はプロバイダーごとに異なる。 */
export async function deleteFile(url: string): Promise<DeleteResult> {
  const provider = getStorageProvider()
  return provider.delete(url)
}
