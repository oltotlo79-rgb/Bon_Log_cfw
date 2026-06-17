/**
 * モバイルデバイストークン関連の制限値
 *
 * @module lib/constants/limits/mobile-device
 */

/**
 * Expo プッシュトークン（ExponentPushToken[xxxxx...]）の最大文字数。
 *
 * Expo トークンは "ExponentPushToken[<22文字のランダム文字列>]" 形式で最大 64 文字程度。
 * APNs / FCM ネイティブトークンは最大 200 文字程度。余裕を持って 512 文字に制限する。
 */
export const MAX_DEVICE_TOKEN_LENGTH = 512
