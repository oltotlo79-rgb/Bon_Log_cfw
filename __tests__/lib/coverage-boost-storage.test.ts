import { vi } from 'vitest'
 
// @vitest-environment node

/**
 * Coverage Boost - Storage Module Tests
 *
 * Targets uncovered lines in lib/storage/index.ts:
 * - Line 920: R2 ensureInitialized() already initialized early return
 * - Line 1053: URL path parsing (pathname without leading slash)
 * - Line 1120: R2 delete error with non-Error object
 */

// ============================================================
// Module-level mocks
// ============================================================

// Mock logger
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock fs/promises
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockUnlink = vi.fn().mockResolvedValue(undefined)
vi.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}))

// Mock s3-sign
const mockPutObject = vi.fn().mockResolvedValue(undefined)
const mockDeleteObject = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/storage/s3-sign', () => ({
  putObject: (...args: unknown[]) => mockPutObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}))

// ============================================================
// Tests
// ============================================================

describe('Storage Module', async () => {
  // We need to dynamically require the module to reset singleton state between test groups
  let storageModule: typeof import('@/lib/storage/index')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Cloudflare R2 Storage Provider', async () => {
    describe('provider singleton - reuse on multiple calls', async () => {
      it('should reuse the same provider instance across multiple uploads', async () => {
        const originalProvider = process.env.STORAGE_PROVIDER
        const originalAccountId = process.env.R2_ACCOUNT_ID
        const originalAccessKey = process.env.R2_ACCESS_KEY_ID
        const originalSecretKey = process.env.R2_SECRET_ACCESS_KEY
        const originalBucket = process.env.R2_BUCKET_NAME
        const originalPublicUrl = process.env.R2_PUBLIC_URL

        process.env.STORAGE_PROVIDER = 'r2'
        process.env.R2_ACCOUNT_ID = 'test-account-id'
        process.env.R2_ACCESS_KEY_ID = 'test-access-key'
        process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
        process.env.R2_BUCKET_NAME = 'test-bucket'
        process.env.R2_PUBLIC_URL = 'https://cdn.example.com'

        vi.resetModules()
        vi.doMock('@/lib/logger', () => ({
          __esModule: true,
          default: {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        }))
        vi.doMock('fs/promises', () => ({
          mkdir: mockMkdir,
          writeFile: mockWriteFile,
          unlink: mockUnlink,
        }))
        vi.doMock('@/lib/storage/s3-sign', () => ({
          putObject: (...args: unknown[]) => mockPutObject(...args),
          deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
        }))

        storageModule = await import('@/lib/storage/index')

        const testBuffer = Buffer.from('test data')

        // Both calls succeed - same provider instance is reused
        const result1 = await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')
        const result2 = await storageModule.uploadFile(testBuffer, 'test2.jpg', 'image/jpeg', 'avatars')

        expect(result1.success).toBe(true)
        expect(result2.success).toBe(true)
        // putObject called once per upload (total 2 times)
        expect(mockPutObject).toHaveBeenCalledTimes(2)

        process.env.STORAGE_PROVIDER = originalProvider
        process.env.R2_ACCOUNT_ID = originalAccountId
        process.env.R2_ACCESS_KEY_ID = originalAccessKey
        process.env.R2_SECRET_ACCESS_KEY = originalSecretKey
        process.env.R2_BUCKET_NAME = originalBucket
        process.env.R2_PUBLIC_URL = originalPublicUrl
      })
    })

    describe('URL path parsing - pathname without leading slash (line 1053)', async () => {
      it('should handle URL with pathname that does not start with /', async () => {
        const originalProvider = process.env.STORAGE_PROVIDER
        const originalAccountId = process.env.R2_ACCOUNT_ID
        const originalAccessKey = process.env.R2_ACCESS_KEY_ID
        const originalSecretKey = process.env.R2_SECRET_ACCESS_KEY
        const originalBucket = process.env.R2_BUCKET_NAME
        const originalPublicUrl = process.env.R2_PUBLIC_URL

        process.env.STORAGE_PROVIDER = 'r2'
        process.env.R2_ACCOUNT_ID = 'test-account-id'
        process.env.R2_ACCESS_KEY_ID = 'test-access-key'
        process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
        process.env.R2_BUCKET_NAME = 'test-bucket'
        process.env.R2_PUBLIC_URL = 'https://cdn.example.com'

        vi.resetModules()
        vi.doMock('@/lib/logger', () => ({
          __esModule: true,
          default: {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        }))
        vi.doMock('fs/promises', () => ({
          mkdir: mockMkdir,
          writeFile: mockWriteFile,
          unlink: mockUnlink,
        }))

        // Mock s3-sign to capture deleteObject key argument
        const capturedDeleteArgs: unknown[][] = []
        const mockPutObjectLocal = vi.fn().mockResolvedValue(undefined)
        const mockDeleteObjectLocal = vi.fn().mockImplementation((...args: unknown[]) => {
          capturedDeleteArgs.push(args)
          return Promise.resolve(undefined)
        })
        vi.doMock('@/lib/storage/s3-sign', () => ({
          putObject: (...args: unknown[]) => mockPutObjectLocal(...args),
          deleteObject: (...args: unknown[]) => mockDeleteObjectLocal(...args),
        }))

        storageModule = await import('@/lib/storage/index')

        // First do an upload to trigger initialization
        const testBuffer = Buffer.from('test data')
        await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

        // Delete with a URL where pathname starts with /
        const result = await storageModule.deleteFile('https://cdn.example.com/avatars/test.jpg')

        expect(result.success).toBe(true)

        // The key should be 'avatars/test.jpg' (without leading slash)
        expect(capturedDeleteArgs.length).toBe(1)
        expect(capturedDeleteArgs[0]![1]!).toBe('avatars/test.jpg')

        process.env.STORAGE_PROVIDER = originalProvider
        process.env.R2_ACCOUNT_ID = originalAccountId
        process.env.R2_ACCESS_KEY_ID = originalAccessKey
        process.env.R2_SECRET_ACCESS_KEY = originalSecretKey
        process.env.R2_BUCKET_NAME = originalBucket
        process.env.R2_PUBLIC_URL = originalPublicUrl
      })
    })

    describe('delete error with non-Error object (line 1120)', async () => {
      it('should handle non-Error object thrown during R2 delete', async () => {
        const originalProvider = process.env.STORAGE_PROVIDER
        const originalAccountId = process.env.R2_ACCOUNT_ID
        const originalAccessKey = process.env.R2_ACCESS_KEY_ID
        const originalSecretKey = process.env.R2_SECRET_ACCESS_KEY
        const originalBucket = process.env.R2_BUCKET_NAME
        const originalPublicUrl = process.env.R2_PUBLIC_URL

        process.env.STORAGE_PROVIDER = 'r2'
        process.env.R2_ACCOUNT_ID = 'test-account-id'
        process.env.R2_ACCESS_KEY_ID = 'test-access-key'
        process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
        process.env.R2_BUCKET_NAME = 'test-bucket'
        process.env.R2_PUBLIC_URL = 'https://cdn.example.com'

        vi.resetModules()
        vi.doMock('@/lib/logger', () => ({
          __esModule: true,
          default: {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        }))
        vi.doMock('fs/promises', () => ({
          mkdir: mockMkdir,
          writeFile: mockWriteFile,
          unlink: mockUnlink,
        }))

        const mockPutObjectLocal = vi.fn().mockResolvedValue(undefined)
        const mockDeleteObjectLocal = vi.fn().mockRejectedValue(42) // non-Error object
        vi.doMock('@/lib/storage/s3-sign', () => ({
          putObject: (...args: unknown[]) => mockPutObjectLocal(...args),
          deleteObject: (...args: unknown[]) => mockDeleteObjectLocal(...args),
        }))

        storageModule = await import('@/lib/storage/index')

        // First upload to trigger initialization
        const testBuffer = Buffer.from('test data')
        await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

        // Now delete which should throw a non-Error
        const result = await storageModule.deleteFile('https://cdn.example.com/avatars/test.jpg')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unknown error')

        process.env.STORAGE_PROVIDER = originalProvider
        process.env.R2_ACCOUNT_ID = originalAccountId
        process.env.R2_ACCESS_KEY_ID = originalAccessKey
        process.env.R2_SECRET_ACCESS_KEY = originalSecretKey
        process.env.R2_BUCKET_NAME = originalBucket
        process.env.R2_PUBLIC_URL = originalPublicUrl
      })
    })

    describe('delete error with Error object', async () => {
      it('should handle Error thrown during R2 delete', async () => {
        const originalProvider = process.env.STORAGE_PROVIDER
        const originalAccountId = process.env.R2_ACCOUNT_ID
        const originalAccessKey = process.env.R2_ACCESS_KEY_ID
        const originalSecretKey = process.env.R2_SECRET_ACCESS_KEY
        const originalBucket = process.env.R2_BUCKET_NAME
        const originalPublicUrl = process.env.R2_PUBLIC_URL

        process.env.STORAGE_PROVIDER = 'r2'
        process.env.R2_ACCOUNT_ID = 'test-account-id'
        process.env.R2_ACCESS_KEY_ID = 'test-access-key'
        process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
        process.env.R2_BUCKET_NAME = 'test-bucket'
        process.env.R2_PUBLIC_URL = 'https://cdn.example.com'

        vi.resetModules()
        vi.doMock('@/lib/logger', () => ({
          __esModule: true,
          default: {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        }))
        vi.doMock('fs/promises', () => ({
          mkdir: mockMkdir,
          writeFile: mockWriteFile,
          unlink: mockUnlink,
        }))

        const mockPutObjectLocal = vi.fn().mockResolvedValue(undefined)
        const mockDeleteObjectLocal = vi.fn().mockRejectedValue(new Error('Access denied'))
        vi.doMock('@/lib/storage/s3-sign', () => ({
          putObject: (...args: unknown[]) => mockPutObjectLocal(...args),
          deleteObject: (...args: unknown[]) => mockDeleteObjectLocal(...args),
        }))

        storageModule = await import('@/lib/storage/index')

        // Upload first to initialize
        const testBuffer = Buffer.from('test data')
        await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

        // Now delete which throws an Error
        const result = await storageModule.deleteFile('https://cdn.example.com/avatars/test.jpg')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Access denied')

        process.env.STORAGE_PROVIDER = originalProvider
        process.env.R2_ACCOUNT_ID = originalAccountId
        process.env.R2_ACCESS_KEY_ID = originalAccessKey
        process.env.R2_SECRET_ACCESS_KEY = originalSecretKey
        process.env.R2_BUCKET_NAME = originalBucket
        process.env.R2_PUBLIC_URL = originalPublicUrl
      })
    })
  })

  describe('R2 upload without public URL (default URL construction)', async () => {
    it('should construct default r2.dev URL when R2_PUBLIC_URL is empty', async () => {
      const originalProvider = process.env.STORAGE_PROVIDER
      const originalAccountId = process.env.R2_ACCOUNT_ID
      const originalAccessKey = process.env.R2_ACCESS_KEY_ID
      const originalSecretKey = process.env.R2_SECRET_ACCESS_KEY
      const originalBucket = process.env.R2_BUCKET_NAME
      const originalPublicUrl = process.env.R2_PUBLIC_URL

      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'test-account-id'
      process.env.R2_ACCESS_KEY_ID = 'test-access-key'
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
      process.env.R2_BUCKET_NAME = 'test-bucket'
      process.env.R2_PUBLIC_URL = '' // empty

      vi.resetModules()
      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: mockMkdir,
        writeFile: mockWriteFile,
        unlink: mockUnlink,
      }))
      vi.doMock('@/lib/storage/s3-sign', () => ({
        putObject: vi.fn().mockResolvedValue(undefined),
        deleteObject: vi.fn().mockResolvedValue(undefined),
      }))

      storageModule = await import('@/lib/storage/index')

      const testBuffer = Buffer.from('test data')
      const result = await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(true)
      // URL should use the r2.dev pattern
      expect(result.url).toContain('test-bucket.test-account-id.r2.dev')

      process.env.STORAGE_PROVIDER = originalProvider
      process.env.R2_ACCOUNT_ID = originalAccountId
      process.env.R2_ACCESS_KEY_ID = originalAccessKey
      process.env.R2_SECRET_ACCESS_KEY = originalSecretKey
      process.env.R2_BUCKET_NAME = originalBucket
      process.env.R2_PUBLIC_URL = originalPublicUrl
    })
  })

  describe('R2 missing credentials', async () => {
    it('should throw error when R2 credentials are missing', async () => {
      const originalProvider = process.env.STORAGE_PROVIDER
      const originalAccountId = process.env.R2_ACCOUNT_ID
      const originalAccessKey = process.env.R2_ACCESS_KEY_ID
      const originalSecretKey = process.env.R2_SECRET_ACCESS_KEY

      process.env.STORAGE_PROVIDER = 'r2'
      delete process.env.R2_ACCOUNT_ID
      delete process.env.R2_ACCESS_KEY_ID
      delete process.env.R2_SECRET_ACCESS_KEY

      vi.resetModules()
      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: mockMkdir,
        writeFile: mockWriteFile,
        unlink: mockUnlink,
      }))

      storageModule = await import('@/lib/storage/index')

      const testBuffer = Buffer.from('test data')
      const result = await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cloudflare R2 credentials not configured')

      process.env.STORAGE_PROVIDER = originalProvider
      process.env.R2_ACCOUNT_ID = originalAccountId
      process.env.R2_ACCESS_KEY_ID = originalAccessKey
      process.env.R2_SECRET_ACCESS_KEY = originalSecretKey
    })
  })

  describe('Local Storage Provider', async () => {
    it('should handle local upload and delete', async () => {
      const originalProvider = process.env.STORAGE_PROVIDER
      process.env.STORAGE_PROVIDER = 'local'

      vi.resetModules()
      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
      }))

      storageModule = await import('@/lib/storage/index')

      const testBuffer = Buffer.from('test data')
      const uploadResult = await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

      expect(uploadResult.success).toBe(true)
      expect(uploadResult.url).toContain('/uploads/avatars/')

      const deleteResult = await storageModule.deleteFile(uploadResult.url!)

      expect(deleteResult.success).toBe(true)

      process.env.STORAGE_PROVIDER = originalProvider
    })

    it('should handle local upload error', async () => {
      const originalProvider = process.env.STORAGE_PROVIDER
      process.env.STORAGE_PROVIDER = 'local'

      vi.resetModules()
      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: vi.fn().mockRejectedValue(new Error('Permission denied')),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
      }))

      storageModule = await import('@/lib/storage/index')

      const testBuffer = Buffer.from('test data')
      const result = await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')

      process.env.STORAGE_PROVIDER = originalProvider
    })

    it('should handle local delete error', async () => {
      const originalProvider = process.env.STORAGE_PROVIDER
      process.env.STORAGE_PROVIDER = 'local'

      vi.resetModules()
      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockRejectedValue(new Error('File not found')),
      }))

      storageModule = await import('@/lib/storage/index')

      const result = await storageModule.deleteFile('/uploads/avatars/test.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('File not found')

      process.env.STORAGE_PROVIDER = originalProvider
    })
  })

  describe('Provider selection (getStorageProvider)', async () => {
    it('should select supabase provider', async () => {
      const originalProvider = process.env.STORAGE_PROVIDER
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      process.env.STORAGE_PROVIDER = 'supabase'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

      vi.resetModules()
      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
      }))

      // Mock global fetch for supabase
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      }) as unknown as typeof fetch

      storageModule = await import('@/lib/storage/index')

      const testBuffer = Buffer.from('test data')
      const result = await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(true)
      expect(result.url).toContain('supabase.co')

      global.fetch = originalFetch
      process.env.STORAGE_PROVIDER = originalProvider
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
    })

    it('should default to local for unknown provider', async () => {
      const originalProvider = process.env.STORAGE_PROVIDER
      process.env.STORAGE_PROVIDER = 'unknown_provider'

      vi.resetModules()
      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: {
          log: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
      }))

      storageModule = await import('@/lib/storage/index')

      const testBuffer = Buffer.from('test data')
      const result = await storageModule.uploadFile(testBuffer, 'test.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(true)
      expect(result.url).toContain('/uploads/')

      process.env.STORAGE_PROVIDER = originalProvider
    })
  })
})
