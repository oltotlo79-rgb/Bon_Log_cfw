/**
 * フォロー・ブロック・ミュート・通知・メッセージ関連のエラーメッセージ
 *
 * @module lib/constants/errors/social
 */

/** 自分自身への操作エラー */
export const ERR_SELF_ACTION = '自分自身に対してこの操作はできません'
export const ERR_SELF_BLOCK = '自分自身をブロックすることはできません'
export const ERR_SELF_MUTE = '自分自身をミュートすることはできません'

/** いいね・ブックマーク・フォロー */
export const ERR_LIKE_FAILED = 'いいねの処理に失敗しました'
export const ERR_BOOKMARK_FAILED = 'ブックマーク操作に失敗しました'
export const ERR_FOLLOW_FAILED = 'フォロー操作に失敗しました'
export const ERR_PRIVATE_ACCOUNT_FOLLOW = 'このユーザーは非公開アカウントです。フォローリクエストを送信してください'

/** スレッド・ブロック・ミュート */
export const ERR_THREAD_MUTE_FAILED = 'スレッドのミュートに失敗しました'
export const ERR_THREAD_UNMUTE_FAILED = 'スレッドのミュート解除に失敗しました'
export const ERR_BLOCK_FAILED = 'ブロックに失敗しました'
export const ERR_UNBLOCK_FAILED = 'ブロック解除に失敗しました'
export const ERR_MUTE_FAILED = 'ミュートに失敗しました'
export const ERR_UNMUTE_FAILED = 'ミュート解除に失敗しました'
export const ERR_MUTED_USERS_FETCH_FAILED = 'ミュートユーザーの取得に失敗しました'

/** フォローリクエスト */
export const ERR_SELF_FOLLOW_REQUEST = '自分自身にフォローリクエストを送ることはできません'
export const ERR_PUBLIC_ACCOUNT_FOLLOW = 'このユーザーは公開アカウントです。直接フォローしてください'
export const ERR_FOLLOW_REQUEST_BLOCKED = 'フォローリクエストを送信できません'
export const ERR_ALREADY_FOLLOWING = '既にフォロー中です'
export const ERR_FOLLOW_REQUEST_ALREADY_SENT = '既にフォローリクエストを送信済みです'
export const ERR_FOLLOW_REQUEST_NOT_FOUND = 'フォローリクエストが見つかりません'
export const ERR_FOLLOW_REQUEST_APPROVE_DENIED = 'このリクエストを承認する権限がありません'
export const ERR_FOLLOW_REQUEST_ALREADY_PROCESSED = 'このリクエストは既に処理されています'
export const ERR_FOLLOW_REQUEST_REJECT_DENIED = 'このリクエストを拒否する権限がありません'

/** メッセージ */
export const ERR_MESSAGE_SEND_FAILED = 'メッセージの送信に失敗しました'
export const ERR_SELF_MESSAGE = '自分自身にメッセージを送ることはできません'
export const ERR_MESSAGE_BLOCKED = 'このユーザーにはメッセージを送れません'
export const ERR_CONVERSATION_ACCESS_DENIED = 'この会話にアクセスする権限がありません'
export const ERR_MESSAGE_DAILY_LIMIT = '1日のメッセージ送信上限に達しました'
export const ERR_CONVERSATION_NOT_FOUND = '会話が見つかりません'
export const ERR_MESSAGE_NOT_FOUND = 'メッセージが見つかりません'
export const ERR_MESSAGE_DELETE_DENIED = 'このメッセージを削除する権限がありません'
export const ERR_CONVERSATION_CREATE_FAILED = '会話の作成に失敗しました'
export const ERR_CONVERSATION_FETCH_FAILED = '会話の取得に失敗しました'
export const ERR_MESSAGE_FETCH_FAILED = 'メッセージの取得に失敗しました'
export const ERR_MESSAGE_READ_FAILED = '既読処理に失敗しました'

/** バリデーション: メッセージ */
export const ERR_CONVERSATION_ID_REQUIRED = '会話IDを指定してください'
export const ERR_MESSAGE_CONTENT_REQUIRED = 'メッセージを入力してください'
export const ERR_MESSAGE_TOO_LONG = (max: number) => `メッセージは${max}文字以内で入力してください`

/** プッシュ通知 */
export const ERR_PUSH_SUBSCRIBE_FAILED = 'プッシュ通知の登録に失敗しました'
export const ERR_PUSH_UNSUBSCRIBE_FAILED = 'プッシュ通知の解除に失敗しました'
export const ERR_PUSH_NOT_CONFIGURED = 'プッシュ通知が設定されていません'
export const ERR_PUSH_SUBSCRIPTION_LIMIT = 'デバイス登録数の上限に達しました'
