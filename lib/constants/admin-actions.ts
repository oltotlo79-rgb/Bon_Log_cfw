/**
 * @module lib/constants/admin-actions
 * `AdminLog.action` に記録するアクション文字列定数。タイポ防止と検索性の向上が目的。
 */

// NGワード
export const ACTION_CREATE_NG_WORD = 'create_ng_word'
export const ACTION_DELETE_NG_WORD = 'delete_ng_word'

// モデレーション
export const ACTION_MODERATION_APPROVED = 'moderation_approved'
export const ACTION_MODERATION_REJECTED = 'moderation_rejected'
export const ACTION_BULK_MODERATION_APPROVED = 'bulk_moderation_approved'
export const ACTION_BULK_MODERATION_REJECTED = 'bulk_moderation_rejected'
export const ACTION_BULK_DELETE_POSTS = 'bulk_delete_posts'
export const ACTION_BULK_SUSPEND_USERS = 'bulk_suspend_users'

// 警告
export const ACTION_ISSUE_WARNING = 'issue_warning'
export const ACTION_DEACTIVATE_WARNING = 'deactivate_warning'

// お知らせ
export const ACTION_CREATE_ANNOUNCEMENT = 'create_announcement'
export const ACTION_DELETE_ANNOUNCEMENT = 'delete_announcement'

// CMS
export const ACTION_UPDATE_CMS_PAGE = 'update_cms_page'
export const ACTION_DELETE_CMS_PAGE = 'delete_cms_page'

// ロール管理
export const ACTION_UPDATE_ADMIN_ROLE = 'update_admin_role'
export const ACTION_ADD_ADMIN = 'add_admin'
export const ACTION_REMOVE_ADMIN = 'remove_admin'

// ユーザー管理
export const ACTION_SUSPEND_USER = 'suspend_user'
export const ACTION_ACTIVATE_USER = 'activate_user'
export const ACTION_DELETE_USER = 'delete_user'

// プレミアム管理
export const ACTION_GRANT_PREMIUM = 'grant_premium'
export const ACTION_REVOKE_PREMIUM = 'revoke_premium'
export const ACTION_EXTEND_PREMIUM = 'extend_premium'

// コンテンツ削除
export const ACTION_DELETE_POST = 'delete_post'
export const ACTION_DELETE_EVENT = 'delete_event'
export const ACTION_DELETE_SHOP = 'delete_shop'
export const ACTION_DELETE_REVIEW = 'delete_review'

// 非表示コンテンツ
export const ACTION_RESTORE_CONTENT = 'restore_content'
export const ACTION_DELETE_HIDDEN_CONTENT = 'delete_hidden_content'

// 農薬データ
export const ACTION_CREATE_PESTICIDE = 'create_pesticide'
export const ACTION_UPDATE_PESTICIDE = 'update_pesticide'
export const ACTION_DELETE_PESTICIDE = 'delete_pesticide'

// セキュリティイベント種別
export const SECURITY_EVENT_FAILED_LOGIN = 'failed_login'
export const SECURITY_EVENT_PASSWORD_CHANGE = 'password_change'
export const SECURITY_EVENT_2FA_TOGGLE = '2fa_toggle'
export const SECURITY_EVENT_EMAIL_CHANGE = 'email_change'
