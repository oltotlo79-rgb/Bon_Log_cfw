/**
 * ステータス関連定数
 *
 * @module lib/constants/status
 */

export const REPORT_STATUS_LABELS: Record<string, string> = {
  pending: '未対応',
  reviewed: '確認中',
  resolved: '対応完了',
  dismissed: '却下',
  auto_hidden: '自動非表示',
}

export const REPORT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  reviewed: 'bg-blue-500/10 text-blue-600',
  resolved: 'bg-green-500/10 text-green-600',
  dismissed: 'bg-gray-500/10 text-gray-600',
  auto_hidden: 'bg-red-500/10 text-red-600',
}

export const POST_STATUS = {
  PENDING: 'pending',
  PUBLISHED: 'published',
  FAILED: 'failed',
} as const

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CANCELLED: 'cancelled',
} as const

// Follow request statuses
export const FOLLOW_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const
export type FollowRequestStatusType = typeof FOLLOW_REQUEST_STATUS[keyof typeof FOLLOW_REQUEST_STATUS]

// Scheduled post statuses
export const SCHEDULED_POST_STATUS = {
  PENDING: 'pending',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const
export type ScheduledPostStatusType = typeof SCHEDULED_POST_STATUS[keyof typeof SCHEDULED_POST_STATUS]

// Contact statuses
export const CONTACT_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const

// Shop change request statuses
export const SHOP_CHANGE_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

// Report statuses
export const REPORT_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  AUTO_HIDDEN: 'auto_hidden',
} as const
