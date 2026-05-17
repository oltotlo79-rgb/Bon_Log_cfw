/**
 * 共通エラーメッセージ定数
 *
 * ドメイン別にファイルを分割し、barrel exportで後方互換性を維持。
 * 既存の `import { ERR_* } from '@/lib/constants/errors'` は変更不要。
 *
 * @module lib/constants/errors
 */

export * from './auth'
export * from './content'
export * from './social'
export * from './entity'
export * from './features'
export * from './admin'
