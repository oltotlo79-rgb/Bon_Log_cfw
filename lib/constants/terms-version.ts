/**
 * @module lib/constants/terms-version
 *
 * モバイル（Native アプリ）が新規登録時に同意を取る利用規約のバージョン定数。
 *
 * lib/constants/legal/ 配下から読み取り専用で import し、このファイル側で
 * `CURRENT_TERMS_VERSION` として再公開する。
 * ANDROID_LEGAL_DOCUMENTS.terms.updatedAt を正とする
 * （モバイルは GET /api/v1/legal/terms で android 向け内容を表示するため）。
 * この定数が変わったら、既存ユーザーの再同意フローが必要になる。
 */

import { ANDROID_LEGAL_DOCUMENTS } from '@/lib/constants/legal'

export const CURRENT_TERMS_VERSION: string = ANDROID_LEGAL_DOCUMENTS.terms.updatedAt
