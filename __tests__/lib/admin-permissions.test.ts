import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  ROLE_LABELS,
  ROLE_PRIORITY,
  canManageRole,
  ACTION_META,
  CATEGORY_LABELS,
  ALL_ADMIN_ACTIONS,
  getRoleCapabilities,
  type AdminActionCategory,
} from '@/lib/admin-permissions'
import type { AdminRole } from '@prisma/client'

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------
describe('hasPermission', () => {
  // --- super_admin has ALL permissions ---
  describe('super_admin', () => {
    it.each([
      'moderation:view',
      'moderation:action',
      'moderation:ng_words',
      'users:view',
      'users:suspend',
      'users:delete',
      'users:activity',
      'posts:view',
      'posts:delete',
      'posts:bulk_action',
      'roles:view',
      'roles:manage',
      'security:view',
      'security:manage',
      'cms:view',
      'cms:manage',
      'backups:manage',
      'maintenance:manage',
      'premium:manage',
    ] as const)('has permission for %s', (action) => {
      expect(hasPermission('super_admin', action)).toBe(true)
    })
  })

  // --- admin has ALL permissions ---
  describe('admin', () => {
    it.each([
      'moderation:view',
      'moderation:action',
      'users:delete',
      'roles:manage',
      'security:manage',
      'cms:manage',
      'backups:manage',
      'maintenance:manage',
      'premium:manage',
      'analytics:export',
    ] as const)('has permission for %s', (action) => {
      expect(hasPermission('admin', action)).toBe(true)
    })
  })

  // --- moderator ---
  describe('moderator', () => {
    it.each([
      'moderation:view',
      'moderation:action',
      'moderation:ng_words',
      'warnings:view',
      'warnings:issue',
      'users:view',
      'users:suspend',
      'users:activity',
      'posts:view',
      'posts:delete',
      'posts:bulk_action',
      'reports:view',
      'reports:action',
      'ip:view',
      'hidden:view',
      'hidden:manage',
      'blacklist:view',
      'blacklist:manage',
      'shops:view',
      'shops:manage',
      'events:view',
      'events:manage',
      'contacts:view',
      'stats:view',
      'logs:view',
      'analytics:view',
      'announcements:view',
    ] as const)('has permission for %s', (action) => {
      expect(hasPermission('moderator', action)).toBe(true)
    })

    it.each([
      'roles:manage',
      'roles:view',
      'cms:manage',
      'cms:view',
      'security:manage',
      'security:view',
      'backups:manage',
      'backups:view',
      'maintenance:manage',
      'maintenance:view',
      'premium:manage',
      'premium:view',
      'users:delete',
      'analytics:export',
      'segments:manage',
      'segments:view',
      'usage:view',
      'pesticide_data:manage',
      'pesticide_data:view',
      'announcements:manage',
      'ip:block',
    ] as const)('does NOT have permission for %s', (action) => {
      expect(hasPermission('moderator', action)).toBe(false)
    })
  })

  // --- support ---
  describe('support', () => {
    it.each([
      'users:view',
      'reports:view',
      'contacts:view',
      'contacts:respond',
      'announcements:view',
      'stats:view',
      'logs:view',
      'hidden:view',
    ] as const)('has permission for %s', (action) => {
      expect(hasPermission('support', action)).toBe(true)
    })

    it.each([
      'users:delete',
      'users:suspend',
      'posts:delete',
      'posts:view',
      'moderation:action',
      'moderation:view',
      'roles:manage',
      'cms:manage',
      'security:manage',
      'ip:block',
      'ip:view',
      'blacklist:manage',
      'hidden:manage',
      'events:manage',
      'shops:manage',
    ] as const)('does NOT have permission for %s', (action) => {
      expect(hasPermission('support', action)).toBe(false)
    })
  })

  // --- readonly ---
  describe('readonly', () => {
    it.each([
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
    ] as const)('has permission for %s', (action) => {
      expect(hasPermission('readonly', action)).toBe(true)
    })

    it.each([
      'moderation:action',
      'moderation:ng_words',
      'warnings:issue',
      'users:suspend',
      'users:delete',
      'users:activity',
      'posts:delete',
      'posts:bulk_action',
      'reports:action',
      'ip:block',
      'segments:manage',
      'analytics:export',
      'announcements:manage',
      'cms:manage',
      'roles:manage',
      'security:manage',
      'backups:manage',
      'pesticide_data:manage',
      'shops:manage',
      'events:manage',
      'contacts:respond',
      'blacklist:manage',
      'maintenance:manage',
      'premium:manage',
      'hidden:manage',
    ] as const)('does NOT have permission for %s', (action) => {
      expect(hasPermission('readonly', action)).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// ROLE_LABELS
// ---------------------------------------------------------------------------
describe('ROLE_LABELS', () => {
  it('has a label for super_admin', () => {
    expect(ROLE_LABELS.super_admin).toBe('スーパー管理者')
  })

  it('has a label for admin', () => {
    expect(ROLE_LABELS.admin).toBe('管理者')
  })

  it('has a label for moderator', () => {
    expect(ROLE_LABELS.moderator).toBe('モデレーター')
  })

  it('has a label for support', () => {
    expect(ROLE_LABELS.support).toBe('サポート')
  })

  it('has a label for readonly', () => {
    expect(ROLE_LABELS.readonly).toBe('閲覧専用')
  })

  it('has exactly 5 roles', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(5)
  })

  it('all labels are non-empty strings', () => {
    for (const label of Object.values(ROLE_LABELS)) {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// ROLE_PRIORITY
// ---------------------------------------------------------------------------
describe('ROLE_PRIORITY', () => {
  it('super_admin has the highest priority', () => {
    expect(ROLE_PRIORITY.super_admin).toBeGreaterThan(ROLE_PRIORITY.admin)
  })

  it('admin is higher than moderator', () => {
    expect(ROLE_PRIORITY.admin).toBeGreaterThan(ROLE_PRIORITY.moderator)
  })

  it('moderator is higher than support', () => {
    expect(ROLE_PRIORITY.moderator).toBeGreaterThan(ROLE_PRIORITY.support)
  })

  it('support is higher than readonly', () => {
    expect(ROLE_PRIORITY.support).toBeGreaterThan(ROLE_PRIORITY.readonly)
  })

  it('has exactly 5 entries', () => {
    expect(Object.keys(ROLE_PRIORITY)).toHaveLength(5)
  })

  it('all priorities are positive numbers', () => {
    for (const priority of Object.values(ROLE_PRIORITY)) {
      expect(priority).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// canManageRole
// ---------------------------------------------------------------------------
describe('canManageRole', () => {
  // --- super_admin ---
  it('super_admin can manage admin', () => {
    expect(canManageRole('super_admin', 'admin')).toBe(true)
  })

  it('super_admin can manage moderator', () => {
    expect(canManageRole('super_admin', 'moderator')).toBe(true)
  })

  it('super_admin can manage support', () => {
    expect(canManageRole('super_admin', 'support')).toBe(true)
  })

  it('super_admin can manage readonly', () => {
    expect(canManageRole('super_admin', 'readonly')).toBe(true)
  })

  it('super_admin cannot manage super_admin', () => {
    expect(canManageRole('super_admin', 'super_admin')).toBe(false)
  })

  // --- admin ---
  it('admin can manage moderator', () => {
    expect(canManageRole('admin', 'moderator')).toBe(true)
  })

  it('admin can manage support', () => {
    expect(canManageRole('admin', 'support')).toBe(true)
  })

  it('admin can manage readonly', () => {
    expect(canManageRole('admin', 'readonly')).toBe(true)
  })

  it('admin cannot manage super_admin', () => {
    expect(canManageRole('admin', 'super_admin')).toBe(false)
  })

  it('admin cannot manage admin', () => {
    expect(canManageRole('admin', 'admin')).toBe(false)
  })

  // --- moderator ---
  it('moderator can manage support', () => {
    expect(canManageRole('moderator', 'support')).toBe(true)
  })

  it('moderator can manage readonly', () => {
    expect(canManageRole('moderator', 'readonly')).toBe(true)
  })

  it('moderator cannot manage admin', () => {
    expect(canManageRole('moderator', 'admin')).toBe(false)
  })

  it('moderator cannot manage super_admin', () => {
    expect(canManageRole('moderator', 'super_admin')).toBe(false)
  })

  it('moderator cannot manage moderator', () => {
    expect(canManageRole('moderator', 'moderator')).toBe(false)
  })

  // --- support ---
  it('support can manage readonly', () => {
    expect(canManageRole('support', 'readonly')).toBe(true)
  })

  it('support cannot manage moderator', () => {
    expect(canManageRole('support', 'moderator')).toBe(false)
  })

  it('support cannot manage admin', () => {
    expect(canManageRole('support', 'admin')).toBe(false)
  })

  it('support cannot manage super_admin', () => {
    expect(canManageRole('support', 'super_admin')).toBe(false)
  })

  it('support cannot manage support', () => {
    expect(canManageRole('support', 'support')).toBe(false)
  })

  // --- readonly ---
  it('readonly cannot manage anyone', () => {
    expect(canManageRole('readonly', 'super_admin')).toBe(false)
    expect(canManageRole('readonly', 'admin')).toBe(false)
    expect(canManageRole('readonly', 'moderator')).toBe(false)
    expect(canManageRole('readonly', 'support')).toBe(false)
    expect(canManageRole('readonly', 'readonly')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ACTION_META / CATEGORY_LABELS / ALL_ADMIN_ACTIONS
// ---------------------------------------------------------------------------
describe('ACTION_META', () => {
  it('全アクションに対して category と label が定義されている', () => {
    for (const action of ALL_ADMIN_ACTIONS) {
      const meta = ACTION_META[action]
      expect(meta).toBeDefined()
      expect(meta.category).toBeDefined()
      expect(meta.label.length).toBeGreaterThan(0)
    }
  })

  it('ALL_ADMIN_ACTIONS は ACTION_META と同じキー集合を持つ', () => {
    expect(new Set(ALL_ADMIN_ACTIONS)).toEqual(new Set(Object.keys(ACTION_META)))
  })

  it('CATEGORY_LABELS は全カテゴリを網羅する', () => {
    const usedCategories = new Set(Object.values(ACTION_META).map((m) => m.category))
    for (const c of usedCategories) {
      expect(CATEGORY_LABELS[c]).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// getRoleCapabilities
// ---------------------------------------------------------------------------
describe('getRoleCapabilities', () => {
  const ALL_CATEGORIES: AdminActionCategory[] = [
    'moderation',
    'users',
    'content',
    'support',
    'analytics',
    'system',
  ]

  it.each(['super_admin', 'admin'] as const)(
    '%s は全アクションが allowed、denied は空',
    (role) => {
      const caps = getRoleCapabilities(role)
      const totalAllowed = ALL_CATEGORIES.reduce(
        (sum, c) => sum + caps[c].allowed.length,
        0,
      )
      const totalDenied = ALL_CATEGORIES.reduce(
        (sum, c) => sum + caps[c].denied.length,
        0,
      )
      expect(totalAllowed).toBe(ALL_ADMIN_ACTIONS.length)
      expect(totalDenied).toBe(0)
    },
  )

  it('readonly は変更系（roles:manage 等）が denied に入る', () => {
    const caps = getRoleCapabilities('readonly')
    expect(caps.system.denied).toContain('roles:manage')
    expect(caps.system.denied).toContain('security:manage')
    expect(caps.system.denied).toContain('maintenance:manage')
  })

  it('moderator はモデレーション系が allowed、ロール管理は denied', () => {
    const caps = getRoleCapabilities('moderator')
    expect(caps.moderation.allowed).toContain('moderation:action')
    expect(caps.moderation.allowed).toContain('moderation:ng_words')
    expect(caps.system.denied).toContain('roles:manage')
  })

  it('support はお問い合わせ対応のみ allowed、削除・停止は denied', () => {
    const caps = getRoleCapabilities('support')
    expect(caps.support.allowed).toContain('contacts:respond')
    expect(caps.users.denied).toContain('users:suspend')
    expect(caps.users.denied).toContain('users:delete')
  })

  it('全ロールで allowed + denied = ALL_ADMIN_ACTIONS', () => {
    const roles: AdminRole[] = ['super_admin', 'admin', 'moderator', 'support', 'readonly']
    for (const role of roles) {
      const caps = getRoleCapabilities(role)
      const total = ALL_CATEGORIES.reduce(
        (sum, c) => sum + caps[c].allowed.length + caps[c].denied.length,
        0,
      )
      expect(total).toBe(ALL_ADMIN_ACTIONS.length)
    }
  })
})
