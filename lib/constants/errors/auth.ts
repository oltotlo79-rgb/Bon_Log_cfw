/**
 * 認証・ログイン・登録・2FA関連のエラーメッセージ
 *
 * @module lib/constants/errors/auth
 */

/** 認証が必要な操作で未ログイン時のエラー */
export const ERR_AUTH_REQUIRED = '認証が必要です'

/** ゲストは投稿・作成などの操作ができない */
export const ERR_GUEST_CANNOT_CREATE =
  '投稿やコメントなどの作成は新規登録後にご利用いただけます。'

/** ゲストはプロフィール編集ができない */
export const ERR_GUEST_PROFILE_EDIT =
  'プロフィール編集は新規登録後にご利用いただけます。'

/** アカウント停止中のエラー */
export const ERR_ACCOUNT_SUSPENDED = 'アカウントが停止されています'

/** 認証・登録関連エラー */
export const ERR_EMAIL_ALREADY_REGISTERED = 'このメールアドレスは既に登録されています'
export const ERR_EMAIL_ALREADY_IN_USE = 'このメールアドレスは既に使用されています'
export const ERR_NICKNAME_RESERVED = 'このユーザー名は利用できません。別のユーザー名をご利用ください。'
export const ERR_EMAIL_BLACKLISTED = 'このメールアドレスは利用できません'
export const ERR_DEVICE_BLACKLISTED = 'このデバイスからの登録は許可されていません'
/** ログイン時にデバイスがブラックリスト登録されている場合のエラー（登録時とは文言を分ける） */
export const ERR_DEVICE_LOGIN_NOT_ALLOWED = 'このデバイスからのログインは許可されていません'
export const ERR_VERIFICATION_EMAIL_FAILED = '確認メールの送信に失敗しました。しばらく経ってからお試しください。'
export const ERR_EMAIL_SEND_FAILED = 'メールの送信に失敗しました。しばらく経ってからお試しください。'
export const ERR_INVALID_TOKEN = '無効なトークンです。'
export const ERR_TOKEN_EXPIRED_OR_INVALID = '無効または期限切れのリンクです。確認メールの再送をお試しください。'
export const ERR_TOKEN_EXPIRED = 'リンクの有効期限が切れています。確認メールの再送をお試しください。'
export const ERR_RESEND_TOO_MANY = '再送の要求が多すぎます。1時間後に再度お試しください。'
export const ERR_RESET_TOO_MANY = 'パスワードリセットの要求が多すぎます。しばらく経ってからお試しください。'
export const ERR_RESET_LINK_INVALID = 'リセットリンクが無効または期限切れです。もう一度お試しください。'
export const ERR_PASSWORD_MIN_LENGTH = 'パスワードは8文字以上で入力してください'
export const ERR_PASSWORD_MAX_LENGTH = 'パスワードは72文字以下で入力してください'
export const ERR_PASSWORD_ALPHANUMERIC = 'パスワードはアルファベットと数字を両方含めてください'
export const ERR_PASSWORD_REQUIRE_LETTER = 'パスワードはアルファベットを含めてください'
export const ERR_PASSWORD_REQUIRE_NUMBER = 'パスワードは数字を含めてください'
export const ERR_NOT_AUTHORIZED = '権限がありません'
export const ERR_NOT_FOUND = '見つかりません'

/** 認証・ログイン */
export const ERR_GUEST_LOGIN_UNAVAILABLE = 'ゲストログインは利用できません'
export const ERR_LOGIN_FAILED = 'ログインに失敗しました'
export const ERR_LOGIN_INVALID_CREDENTIALS = 'メールアドレスまたはパスワードが間違っています'
export const ERR_LOGIN_ERROR = 'ログイン中にエラーが発生しました'
/**
 * メールアドレス未確認でのログイン拒否。
 * この error 文字列を識別子として UI が「確認メール再送」ボタンを表示する。
 */
export const ERR_EMAIL_NOT_VERIFIED = 'メールアドレスがまだ確認されていません。確認メールのリンクをクリックするか、下のボタンから再送してください。'
export const ERR_AUTH_ERROR = '認証エラー'

/** 2段階認証 */
export const ERR_2FA_ALREADY_ENABLED = '2段階認証は既に有効です'
export const ERR_2FA_INVALID_CODE = '認証コードが正しくありません'
export const ERR_2FA_NOT_ENABLED = '2段階認証が有効ではありません'
export const ERR_2FA_SETUP_EXPIRED = '2段階認証のセットアップ情報が見つからないか期限切れです。最初からやり直してください'
export const ERR_NO_PASSWORD_SET = 'パスワードが設定されていません'
export const ERR_INCORRECT_PASSWORD = 'パスワードが正しくありません'

/** メールアドレス変更（確認メール経由の二段階） */
export const ERR_EMAIL_CHANGE_TOO_MANY = 'メールアドレス変更の要求が多すぎます。しばらく経ってからお試しください。'
export const ERR_EMAIL_CHANGE_LINK_INVALID = 'メールアドレス変更の確認リンクが無効または期限切れです。もう一度お試しください。'
