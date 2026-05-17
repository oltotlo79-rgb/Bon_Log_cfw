// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  // admin
  BULK_MODERATION_MAX,
  BULK_DELETE_POSTS_MAX,
  BULK_SUSPEND_USERS_MAX,
  SUSPICIOUS_LIKES_PER_HOUR,
  SUSPICIOUS_POSTS_PER_DAY,
  SUSPICIOUS_REPORTS_THRESHOLD,
  SUSPICIOUS_FOLLOWS_PER_HOUR,
  ACTIVE_ANNOUNCEMENTS_LIMIT,
  CMS_VERSION_HISTORY_LIMIT,
  CSV_EXPORT_MAX_ROWS,
  COHORT_ANALYSIS_MAX_RECORDS,
  NOTIFICATION_BATCH_SIZE,
  ANALYTICS_DAYS_RANGE,
  ADMIN_VISITORS_DAYS_RANGES,
  ADMIN_VISITORS_DEFAULT_DAYS,
  NG_WORD_MAX_LENGTH,
  NG_WORDS_CACHE_TTL_SECONDS,
  CMS_SLUG_PATTERN,
  CMS_SLUG_RESERVED,
  HEALTH_CHECK_PING_TTL_SECONDS,
  REDIS_LATENCY_DEGRADED_THRESHOLD_MS,
  DEFAULT_PREMIUM_GRANT_DAYS,

  // auth
  PASSWORD_MIN_LENGTH,
  TWO_FACTOR_CODE_LENGTH,
  BCRYPT_SALT_ROUNDS,
  NONCE_BYTE_LENGTH,
  MIN_FINGERPRINT_LENGTH,
  MAX_FINGERPRINT_LENGTH,
  BACKUP_CODE_COUNT,
  BACKUP_CODE_LENGTH,
  TOTP_PERIOD_SECONDS,
  MAX_LOGIN_ATTEMPTS,
  MAX_IP_LOGIN_ATTEMPTS,
  LOGIN_WINDOW_MINUTES,
  LOGIN_LOCKOUT_MINUTES,
  MIN_SECRET_LENGTH,
  CRON_TIMESTAMP_TOLERANCE_MINUTES,
  MIN_TOKEN_LENGTH,
  MAX_RESEND_VERIFICATION_ATTEMPTS,
  MAX_PASSWORD_RESET_ATTEMPTS,
  TOKEN_RANDOM_BYTES,
  HSTS_MAX_AGE_SECONDS,

  // pagination
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  ADMIN_LOGS_PAGE_LIMIT,
  RECOMMENDED_USERS_LIMIT,
  RSS_FEED_LIMIT,
  CRON_BATCH_SIZE,
  SITEMAP_USERS_LIMIT,
  SITEMAP_POSTS_LIMIT,
  SITEMAP_EVENTS_LIMIT,
  SITEMAP_SHOPS_LIMIT,
  MAX_EVENTS_LIMIT,
  MAX_SHOPS_LIMIT,
  MAX_RELATION_FETCH,

  // post
  MAX_POST_CONTENT_FREE,
  MAX_POST_CONTENT_PREMIUM,
  MAX_DAILY_POSTS_FREE,
  MAX_DAILY_POSTS_PREMIUM,
  MIN_RATING,
  MAX_RATING,
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  VALID_POLL_DURATIONS,
  DEFAULT_POLL_DURATION_SECONDS,
  MAX_COMMENT_LENGTH,
  DAILY_COMMENT_LIMIT,
  MAX_MESSAGE_LENGTH,
  DAILY_MESSAGE_LIMIT,
  MAX_GENRES_PER_POST,
  MAX_SCHEDULED_DAYS_AHEAD,
  MAX_PENDING_SCHEDULED_POSTS,
  MAX_POST_IMAGES_PREMIUM,
  MAX_POST_VIDEOS_PREMIUM,
  DAILY_UPLOAD_LIMIT,
  MAX_NICKNAME_LENGTH,
  MAX_BIO_LENGTH,
  MIN_CONTACT_MESSAGE_LENGTH,
  MAX_CONTACT_MESSAGE_LENGTH,
  BONSAI_START_MIN_YEAR,
} from '@/lib/constants/limits'

describe('lib/constants/limits', () => {
  // =================================================================
  // admin.ts
  // =================================================================
  describe('admin limits', () => {
    it('bulk operation limits are positive numbers', () => {
      for (const val of [BULK_MODERATION_MAX, BULK_DELETE_POSTS_MAX, BULK_SUSPEND_USERS_MAX]) {
        expect(val).toBeGreaterThan(0)
      }
    })

    it('suspicious activity thresholds are positive numbers', () => {
      for (const val of [
        SUSPICIOUS_LIKES_PER_HOUR,
        SUSPICIOUS_POSTS_PER_DAY,
        SUSPICIOUS_REPORTS_THRESHOLD,
        SUSPICIOUS_FOLLOWS_PER_HOUR,
      ]) {
        expect(val).toBeGreaterThan(0)
      }
    })

    it('display/pagination limits are positive numbers', () => {
      for (const val of [
        ACTIVE_ANNOUNCEMENTS_LIMIT,
        CMS_VERSION_HISTORY_LIMIT,
        CSV_EXPORT_MAX_ROWS,
        COHORT_ANALYSIS_MAX_RECORDS,
        NOTIFICATION_BATCH_SIZE,
        ANALYTICS_DAYS_RANGE,
      ]) {
        expect(val).toBeGreaterThan(0)
      }
    })

    it('NG word and cache limits are positive', () => {
      expect(NG_WORD_MAX_LENGTH).toBeGreaterThan(0)
      expect(NG_WORDS_CACHE_TTL_SECONDS).toBeGreaterThan(0)
    })

    it('monitoring limits are positive', () => {
      expect(HEALTH_CHECK_PING_TTL_SECONDS).toBeGreaterThan(0)
      expect(REDIS_LATENCY_DEGRADED_THRESHOLD_MS).toBeGreaterThan(0)
      expect(DEFAULT_PREMIUM_GRANT_DAYS).toBeGreaterThan(0)
    })

    describe('ADMIN_VISITORS_DAYS_RANGES', () => {
      it('要素は重複なし、すべて正の整数', () => {
        const set = new Set(ADMIN_VISITORS_DAYS_RANGES)
        expect(set.size).toBe(ADMIN_VISITORS_DAYS_RANGES.length)
        for (const v of ADMIN_VISITORS_DAYS_RANGES) {
          expect(Number.isInteger(v)).toBe(true)
          expect(v).toBeGreaterThan(0)
        }
      })

      it('昇順に並んでいる（UI のタブ並び順を保証）', () => {
        const sorted = [...ADMIN_VISITORS_DAYS_RANGES].sort((a, b) => a - b)
        expect(ADMIN_VISITORS_DAYS_RANGES).toEqual(sorted)
      })

      it('ADMIN_VISITORS_DEFAULT_DAYS は許可リストに含まれる値であること', () => {
        expect(ADMIN_VISITORS_DAYS_RANGES.includes(ADMIN_VISITORS_DEFAULT_DAYS)).toBe(true)
      })
    })

    describe('CMS_SLUG_PATTERN', () => {
      it('matches valid slugs', () => {
        const validSlugs = ['about', 'my-page', 'page_1', 'a', '0-slug', '123']
        for (const slug of validSlugs) {
          expect(CMS_SLUG_PATTERN.test(slug)).toBe(true)
        }
      })

      it('rejects invalid slugs', () => {
        const invalidSlugs = ['-start', '_start', 'UPPER', 'has space', 'special!', '', 'にほんご']
        for (const slug of invalidSlugs) {
          // Reset lastIndex since the regex has no global flag, but be safe
          CMS_SLUG_PATTERN.lastIndex = 0
          expect(CMS_SLUG_PATTERN.test(slug)).toBe(false)
        }
      })
    })

    describe('CMS_SLUG_RESERVED', () => {
      it('is a non-empty array', () => {
        expect(Array.isArray(CMS_SLUG_RESERVED)).toBe(true)
        expect(CMS_SLUG_RESERVED.length).toBeGreaterThan(0)
      })

      it('contains expected reserved words', () => {
        for (const word of ['admin', 'api', 'auth', 'login', 'settings']) {
          expect(CMS_SLUG_RESERVED).toContain(word)
        }
      })

      it('contains only lowercase strings', () => {
        for (const word of CMS_SLUG_RESERVED) {
          expect(word).toBe(word.toLowerCase())
        }
      })
    })
  })

  // =================================================================
  // auth.ts
  // =================================================================
  describe('auth limits', () => {
    it('all numeric constants are positive', () => {
      for (const val of [
        PASSWORD_MIN_LENGTH,
        TWO_FACTOR_CODE_LENGTH,
        BCRYPT_SALT_ROUNDS,
        NONCE_BYTE_LENGTH,
        MIN_FINGERPRINT_LENGTH,
        MAX_FINGERPRINT_LENGTH,
        BACKUP_CODE_COUNT,
        BACKUP_CODE_LENGTH,
        TOTP_PERIOD_SECONDS,
        MAX_LOGIN_ATTEMPTS,
        MAX_IP_LOGIN_ATTEMPTS,
        LOGIN_WINDOW_MINUTES,
        LOGIN_LOCKOUT_MINUTES,
        MIN_SECRET_LENGTH,
        CRON_TIMESTAMP_TOLERANCE_MINUTES,
        MIN_TOKEN_LENGTH,
        MAX_RESEND_VERIFICATION_ATTEMPTS,
        MAX_PASSWORD_RESET_ATTEMPTS,
        TOKEN_RANDOM_BYTES,
        HSTS_MAX_AGE_SECONDS,
      ]) {
        expect(val).toBeGreaterThan(0)
      }
    })

    it('PASSWORD_MIN_LENGTH is at least 8', () => {
      expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8)
    })

    it('HSTS_MAX_AGE_SECONDS equals one year in seconds', () => {
      const oneYearInSeconds = 365 * 24 * 60 * 60
      expect(HSTS_MAX_AGE_SECONDS).toBe(oneYearInSeconds)
    })

    it('MAX_IP_LOGIN_ATTEMPTS >= MAX_LOGIN_ATTEMPTS', () => {
      expect(MAX_IP_LOGIN_ATTEMPTS).toBeGreaterThanOrEqual(MAX_LOGIN_ATTEMPTS)
    })

    it('MIN_FINGERPRINT_LENGTH < MAX_FINGERPRINT_LENGTH', () => {
      expect(MIN_FINGERPRINT_LENGTH).toBeLessThan(MAX_FINGERPRINT_LENGTH)
    })

    it('LOGIN_LOCKOUT_MINUTES > LOGIN_WINDOW_MINUTES', () => {
      expect(LOGIN_LOCKOUT_MINUTES).toBeGreaterThan(LOGIN_WINDOW_MINUTES)
    })
  })

  // =================================================================
  // pagination.ts
  // =================================================================
  describe('pagination limits', () => {
    it('all numeric constants are positive', () => {
      for (const val of [
        DEFAULT_PAGE_LIMIT,
        MAX_PAGE_LIMIT,
        ADMIN_LOGS_PAGE_LIMIT,
        RECOMMENDED_USERS_LIMIT,
        RSS_FEED_LIMIT,
        CRON_BATCH_SIZE,
        SITEMAP_USERS_LIMIT,
        SITEMAP_POSTS_LIMIT,
        SITEMAP_EVENTS_LIMIT,
        SITEMAP_SHOPS_LIMIT,
        MAX_EVENTS_LIMIT,
        MAX_SHOPS_LIMIT,
        MAX_RELATION_FETCH,
      ]) {
        expect(val).toBeGreaterThan(0)
      }
    })

    it('MAX_PAGE_LIMIT >= DEFAULT_PAGE_LIMIT', () => {
      expect(MAX_PAGE_LIMIT).toBeGreaterThanOrEqual(DEFAULT_PAGE_LIMIT)
    })
  })

  // =================================================================
  // post.ts
  // =================================================================
  describe('post limits', () => {
    it('all numeric constants are positive', () => {
      for (const val of [
        MAX_POST_CONTENT_FREE,
        MAX_POST_CONTENT_PREMIUM,
        MAX_DAILY_POSTS_FREE,
        MAX_DAILY_POSTS_PREMIUM,
        MAX_COMMENT_LENGTH,
        DAILY_COMMENT_LIMIT,
        MAX_MESSAGE_LENGTH,
        DAILY_MESSAGE_LIMIT,
        MAX_GENRES_PER_POST,
        MAX_SCHEDULED_DAYS_AHEAD,
        MAX_PENDING_SCHEDULED_POSTS,
        MAX_POST_IMAGES_PREMIUM,
        MAX_POST_VIDEOS_PREMIUM,
        DAILY_UPLOAD_LIMIT,
        MAX_NICKNAME_LENGTH,
        MAX_BIO_LENGTH,
        MIN_CONTACT_MESSAGE_LENGTH,
        MAX_CONTACT_MESSAGE_LENGTH,
        DEFAULT_POLL_DURATION_SECONDS,
      ]) {
        expect(val).toBeGreaterThan(0)
      }
    })

    it('premium content limit >= free content limit', () => {
      expect(MAX_POST_CONTENT_PREMIUM).toBeGreaterThanOrEqual(MAX_POST_CONTENT_FREE)
    })

    it('premium daily posts limit >= free daily posts limit', () => {
      expect(MAX_DAILY_POSTS_PREMIUM).toBeGreaterThanOrEqual(MAX_DAILY_POSTS_FREE)
    })

    it('MIN_CONTACT_MESSAGE_LENGTH < MAX_CONTACT_MESSAGE_LENGTH', () => {
      expect(MIN_CONTACT_MESSAGE_LENGTH).toBeLessThan(MAX_CONTACT_MESSAGE_LENGTH)
    })

    describe('rating range', () => {
      it('MIN_RATING >= 1', () => {
        expect(MIN_RATING).toBeGreaterThanOrEqual(1)
      })

      it('MAX_RATING <= 5', () => {
        expect(MAX_RATING).toBeLessThanOrEqual(5)
      })

      it('MIN_RATING < MAX_RATING', () => {
        expect(MIN_RATING).toBeLessThan(MAX_RATING)
      })
    })

    describe('poll options', () => {
      it('MIN_POLL_OPTIONS >= 2', () => {
        expect(MIN_POLL_OPTIONS).toBeGreaterThanOrEqual(2)
      })

      it('MAX_POLL_OPTIONS > MIN_POLL_OPTIONS', () => {
        expect(MAX_POLL_OPTIONS).toBeGreaterThan(MIN_POLL_OPTIONS)
      })
    })

    describe('VALID_POLL_DURATIONS', () => {
      it('is a non-empty array', () => {
        expect(VALID_POLL_DURATIONS.length).toBeGreaterThan(0)
      })

      it('contains only positive numbers', () => {
        for (const duration of VALID_POLL_DURATIONS) {
          expect(duration).toBeGreaterThan(0)
        }
      })

      it('is sorted in ascending order', () => {
        for (let i = 1; i < VALID_POLL_DURATIONS.length; i++) {
          expect(VALID_POLL_DURATIONS[i]).toBeGreaterThan(VALID_POLL_DURATIONS[i - 1])
        }
      })

      it('DEFAULT_POLL_DURATION_SECONDS is included in VALID_POLL_DURATIONS', () => {
        expect(VALID_POLL_DURATIONS).toContain(DEFAULT_POLL_DURATION_SECONDS)
      })
    })

    it('BONSAI_START_MIN_YEAR is a reasonable year', () => {
      expect(BONSAI_START_MIN_YEAR).toBeGreaterThanOrEqual(1900)
      expect(BONSAI_START_MIN_YEAR).toBeLessThanOrEqual(2000)
    })
  })
})
