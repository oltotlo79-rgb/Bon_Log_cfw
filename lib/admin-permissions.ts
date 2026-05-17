/**
 * 管理者権限マトリクス
 *
 * AdminRole ごとに許可されるアクションを定義する。
 * DB ではなくコードで管理（ロール数が少なく静的なため）。
 *
 * @module lib/admin-permissions
 */

import type { AdminRole } from '@prisma/client'

/** 管理者アクションの種別 */
export type AdminAction =
  // モデレーション
  | 'moderation:view'
  | 'moderation:action'
  | 'moderation:ng_words'
  // 警告
  | 'warnings:view'
  | 'warnings:issue'
  // ユーザー管理
  | 'users:view'
  | 'users:suspend'
  | 'users:delete'
  | 'users:activity'
  // 投稿管理
  | 'posts:view'
  | 'posts:delete'
  | 'posts:bulk_action'
  // 通報
  | 'reports:view'
  | 'reports:action'
  // IP管理
  | 'ip:view'
  | 'ip:block'
  // セグメント
  | 'segments:view'
  | 'segments:manage'
  // 分析
  | 'analytics:view'
  | 'analytics:export'
  // お知らせ
  | 'announcements:view'
  | 'announcements:manage'
  // CMS
  | 'cms:view'
  | 'cms:manage'
  // ロール管理
  | 'roles:view'
  | 'roles:manage'
  // セキュリティ
  | 'security:view'
  | 'security:manage'
  // バックアップ
  | 'backups:view'
  | 'backups:manage'
  // 農薬データ
  | 'pesticide_data:view'
  | 'pesticide_data:manage'
  // 盆栽園
  | 'shops:view'
  | 'shops:manage'
  // イベント
  | 'events:view'
  | 'events:manage'
  // お問い合わせ
  | 'contacts:view'
  | 'contacts:respond'
  // ブラックリスト
  | 'blacklist:view'
  | 'blacklist:manage'
  // 統計
  | 'stats:view'
  // サービス使用量
  | 'usage:view'
  // メンテナンス
  | 'maintenance:view'
  | 'maintenance:manage'
  // ログ
  | 'logs:view'
  // プレミアム
  | 'premium:view'
  | 'premium:manage'
  // 非表示コンテンツ
  | 'hidden:view'
  | 'hidden:manage'
  // ハッシュタグ保守
  | 'hashtags:recalculate'
  // 全文検索インフラ
  | 'search:setup'

/**
 * ロール別の許可アクション定義
 *
 * super_admin / admin: 全権限
 * moderator: モデレーション・警告・ユーザー停止・投稿管理・通報対応
 * support: ユーザー閲覧・お問い合わせ対応・通報閲覧
 * readonly: 全画面閲覧のみ
 */
const PERMISSION_MAP: Record<AdminRole, AdminAction[]> = {
  super_admin: [], // 特別扱い: 全権限
  admin: [], // 特別扱い: 全権限
  moderator: [
    'moderation:view', 'moderation:action', 'moderation:ng_words',
    'warnings:view', 'warnings:issue',
    'users:view', 'users:suspend', 'users:activity',
    'posts:view', 'posts:delete', 'posts:bulk_action',
    'reports:view', 'reports:action',
    'ip:view',
    'hidden:view', 'hidden:manage',
    'blacklist:view', 'blacklist:manage',
    'shops:view', 'shops:manage',
    'events:view', 'events:manage',
    'contacts:view',
    'stats:view',
    'logs:view',
    'analytics:view',
    'announcements:view',
  ],
  support: [
    'users:view',
    'reports:view',
    'contacts:view', 'contacts:respond',
    'announcements:view',
    'stats:view',
    'logs:view',
    'hidden:view',
  ],
  readonly: [
    'moderation:view',
    'warnings:view',
    'users:view',
    'posts:view',
    'reports:view',
    'ip:view',
    'segments:view',
    'analytics:view',
    'announcements:view',
    'cms:view',
    'roles:view',
    'security:view',
    'backups:view',
    'pesticide_data:view',
    'shops:view',
    'events:view',
    'contacts:view',
    'blacklist:view',
    'stats:view',
    'usage:view',
    'maintenance:view',
    'logs:view',
    'premium:view',
    'hidden:view',
  ],
}

/** ロールが指定アクションを許可されているか判定 */
export function hasPermission(role: AdminRole, action: AdminAction): boolean {
  if (role === 'super_admin' || role === 'admin') return true
  return PERMISSION_MAP[role]?.includes(action) ?? false
}

/** ロールの表示名 */
export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'スーパー管理者',
  admin: '管理者',
  moderator: 'モデレーター',
  support: 'サポート',
  readonly: '閲覧専用',
}

/** ロールの優先度（高い数値 = 高権限） */
export const ROLE_PRIORITY: Record<AdminRole, number> = {
  super_admin: 100,
  admin: 80,
  moderator: 60,
  support: 40,
  readonly: 20,
}

/** 自分より低いロールのみ変更可能 */
export function canManageRole(myRole: AdminRole, targetRole: AdminRole): boolean {
  return ROLE_PRIORITY[myRole] > ROLE_PRIORITY[targetRole]
}

/**
 * 管理者アクションのカテゴリ。UI で「できる／できない」を
 * 機能ごとに整理して表示するために使う。
 */
export type AdminActionCategory =
  | 'moderation'
  | 'users'
  | 'content'
  | 'support'
  | 'analytics'
  | 'system'

/** カテゴリの表示ラベル */
export const CATEGORY_LABELS: Record<AdminActionCategory, string> = {
  moderation: 'モデレーション',
  users: 'ユーザー管理',
  content: 'コンテンツ管理',
  support: 'サポート・通報',
  analytics: '分析・統計',
  system: 'システム設定',
}

/** アクションごとの表示ラベル + カテゴリ */
export const ACTION_META: Record<AdminAction, { category: AdminActionCategory; label: string }> = {
  // モデレーション
  'moderation:view':      { category: 'moderation', label: 'モデレーションキュー閲覧' },
  'moderation:action':    { category: 'moderation', label: 'モデレーション対応（承認・却下）' },
  'moderation:ng_words':  { category: 'moderation', label: 'NGワード管理' },
  'warnings:view':        { category: 'moderation', label: '警告履歴の閲覧' },
  'warnings:issue':       { category: 'moderation', label: '警告の発行' },
  'hidden:view':          { category: 'moderation', label: '非表示コンテンツの閲覧' },
  'hidden:manage':        { category: 'moderation', label: '非表示コンテンツの管理' },
  'blacklist:view':       { category: 'moderation', label: 'ブラックリストの閲覧' },
  'blacklist:manage':     { category: 'moderation', label: 'ブラックリストの追加・削除' },

  // ユーザー管理
  'users:view':           { category: 'users', label: 'ユーザー一覧・詳細の閲覧' },
  'users:suspend':        { category: 'users', label: 'アカウント停止／解除' },
  'users:delete':         { category: 'users', label: 'アカウント削除' },
  'users:activity':       { category: 'users', label: 'ユーザー活動履歴の閲覧' },
  'ip:view':              { category: 'users', label: 'IPアドレス一覧の閲覧' },
  'ip:block':             { category: 'users', label: 'IPアドレスのブロック／解除' },
  'segments:view':        { category: 'users', label: 'ユーザーセグメントの閲覧' },
  'segments:manage':      { category: 'users', label: 'ユーザーセグメントの作成・編集' },

  // コンテンツ管理
  'posts:view':           { category: 'content', label: '投稿一覧の閲覧' },
  'posts:delete':         { category: 'content', label: '投稿の削除' },
  'posts:bulk_action':    { category: 'content', label: '投稿の一括操作' },
  'shops:view':           { category: 'content', label: '盆栽園情報の閲覧' },
  'shops:manage':         { category: 'content', label: '盆栽園情報の編集・削除' },
  'events:view':          { category: 'content', label: 'イベントの閲覧' },
  'events:manage':        { category: 'content', label: 'イベントの編集・削除' },
  'announcements:view':   { category: 'content', label: 'お知らせの閲覧' },
  'announcements:manage': { category: 'content', label: 'お知らせの作成・編集・削除' },
  'cms:view':             { category: 'content', label: 'CMS（静的ページ）の閲覧' },
  'cms:manage':           { category: 'content', label: 'CMS（静的ページ）の編集' },
  'pesticide_data:view':  { category: 'content', label: '農薬データの閲覧' },
  'pesticide_data:manage':{ category: 'content', label: '農薬データの編集・承認' },
  'hashtags:recalculate': { category: 'content', label: 'ハッシュタグ集計の再計算' },

  // サポート・通報
  'reports:view':         { category: 'support', label: '通報一覧の閲覧' },
  'reports:action':       { category: 'support', label: '通報への対応' },
  'contacts:view':        { category: 'support', label: 'お問い合わせ閲覧' },
  'contacts:respond':     { category: 'support', label: 'お問い合わせ対応・返信' },

  // 分析・統計
  'analytics:view':       { category: 'analytics', label: '分析ダッシュボードの閲覧' },
  'analytics:export':     { category: 'analytics', label: '分析データのエクスポート' },
  'stats:view':           { category: 'analytics', label: '基本統計の閲覧' },
  'usage:view':           { category: 'analytics', label: 'サービス使用量の閲覧' },

  // システム設定
  'roles:view':           { category: 'system', label: '管理者ロールの閲覧' },
  'roles:manage':         { category: 'system', label: '管理者ロールの付与・変更' },
  'security:view':        { category: 'system', label: 'セキュリティ設定の閲覧' },
  'security:manage':      { category: 'system', label: 'セキュリティ設定の変更' },
  'backups:view':         { category: 'system', label: 'バックアップ履歴の閲覧' },
  'backups:manage':       { category: 'system', label: 'バックアップの作成・復元' },
  'maintenance:view':     { category: 'system', label: 'メンテナンスモード状態の閲覧' },
  'maintenance:manage':   { category: 'system', label: 'メンテナンスモードの切替' },
  'logs:view':            { category: 'system', label: '監査ログの閲覧' },
  'premium:view':         { category: 'system', label: 'プレミアム会員情報の閲覧' },
  'premium:manage':       { category: 'system', label: 'プレミアム会員の手動付与・解除' },
  'search:setup':         { category: 'system', label: '全文検索インフラのセットアップ' },
}

/** 全アクション一覧（宣言順） */
export const ALL_ADMIN_ACTIONS = Object.keys(ACTION_META) as AdminAction[]

/**
 * あるロールの「許可アクション」と「拒否アクション」をカテゴリ別にまとめる。
 * `/admin/roles` の詳細解説カードでそのまま使える形に整形する。
 */
export function getRoleCapabilities(role: AdminRole): Record<
  AdminActionCategory,
  { allowed: AdminAction[]; denied: AdminAction[] }
> {
  const categories: AdminActionCategory[] = ['moderation', 'users', 'content', 'support', 'analytics', 'system']
  const result = {} as Record<AdminActionCategory, { allowed: AdminAction[]; denied: AdminAction[] }>
  for (const category of categories) {
    result[category] = { allowed: [], denied: [] }
  }
  for (const action of ALL_ADMIN_ACTIONS) {
    const meta = ACTION_META[action]
    const bucket = result[meta.category]
    if (hasPermission(role, action)) bucket.allowed.push(action)
    else bucket.denied.push(action)
  }
  return result
}
