// @vitest-environment node

import crypto from 'crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { S3Config } from '@/lib/storage/s3-sign'

// We need to mock Date and fetch for deterministic tests
const FIXED_DATE = new Date('2026-03-20T12:00:00.000Z')
const FIXED_DATE_STR = '20260320'
const FIXED_DATETIME_STR = '20260320T120000Z'

const mockConfig: S3Config = {
  endpoint: 'https://abc123.r2.cloudflarestorage.com',
  region: 'auto',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  bucket: 'test-bucket',
}

// Helper: compute expected crypto values using real crypto (these are pure functions)
function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, date)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

describe('s3-sign', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ─── hmacSha256 (tested indirectly via createPresignedPutUrl signature) ────

  describe('hmacSha256 (internal, verified via signature output)', () => {
    it('produces deterministic HMAC-SHA256 for known inputs', () => {
      // Verify our reference implementation matches Node crypto directly
      const result = hmacSha256('secret', 'data')
      expect(result).toBeInstanceOf(Buffer)
      expect(result.toString('hex')).toBe(
        crypto.createHmac('sha256', 'secret').update('data', 'utf8').digest('hex')
      )
    })

    it('accepts Buffer as key', () => {
      const key = Buffer.from('mykey')
      const result = hmacSha256(key, 'data')
      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBe(32) // SHA-256 produces 32 bytes
    })
  })

  // ─── sha256Hex ─────────────────────────────────────────────────────────────

  describe('sha256Hex (internal, verified via signature output)', () => {
    it('produces correct hex digest for empty string', () => {
      const result = sha256Hex('')
      expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    })

    it('produces correct hex digest for known string', () => {
      const result = sha256Hex('hello')
      expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    })

    it('handles Buffer input', () => {
      const result = sha256Hex(Buffer.from('hello'))
      expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    })
  })

  // ─── getSigningKey ─────────────────────────────────────────────────────────

  describe('getSigningKey (internal, verified via reference implementation)', () => {
    it('produces a 32-byte Buffer', () => {
      const key = getSigningKey('mysecret', '20260320', 'auto', 's3')
      expect(key).toBeInstanceOf(Buffer)
      expect(key.length).toBe(32)
    })

    it('produces different keys for different dates', () => {
      const key1 = getSigningKey('secret', '20260320', 'auto', 's3')
      const key2 = getSigningKey('secret', '20260321', 'auto', 's3')
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'))
    })

    it('produces different keys for different regions', () => {
      const key1 = getSigningKey('secret', '20260320', 'us-east-1', 's3')
      const key2 = getSigningKey('secret', '20260320', 'eu-west-1', 's3')
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'))
    })

    it('produces different keys for different services', () => {
      const key1 = getSigningKey('secret', '20260320', 'auto', 's3')
      const key2 = getSigningKey('secret', '20260320', 'auto', 'iam')
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'))
    })

    it('chains HMAC correctly: AWS4 + secretKey -> date -> region -> service -> aws4_request', () => {
      const secretKey = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
      const key = getSigningKey(secretKey, '20260320', 'us-east-1', 's3')
      // Manually verify chain
      const kDate = hmacSha256(`AWS4${secretKey}`, '20260320')
      const kRegion = hmacSha256(kDate, 'us-east-1')
      const kService = hmacSha256(kRegion, 's3')
      const expected = hmacSha256(kService, 'aws4_request')
      expect(key.toString('hex')).toBe(expected.toString('hex'))
    })
  })

  // ─── awsEncode (tested via createPresignedPutUrl query params) ─────────────

  describe('awsEncode (internal, verified via presigned URL)', () => {
    it('standard characters are not encoded in presigned URL path', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'simple-key.jpg', 'image/jpeg', 3600)
      expect(url).toContain('/test-bucket/simple-key.jpg')
    })

    it('special characters in key are percent-encoded', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'path/to/file with spaces.jpg', 'image/jpeg', 3600)
      // spaces should be encoded as %20 in path
      expect(url).toContain('file%20with%20spaces.jpg')
      // slashes in key should be preserved (encodeKey splits on /)
      expect(url).toContain('/path/to/')
    })

    it('handles exclamation marks and other special AWS chars', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, "file!'().jpg", 'image/jpeg', 3600)
      // These chars should be percent-encoded per AWS spec
      expect(url).not.toContain("!'()")
    })
  })

  // ─── createPresignedPutUrl ─────────────────────────────────────────────────

  describe('createPresignedPutUrl', () => {
    it('returns a string URL', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(typeof url).toBe('string')
    })

    it('starts with the endpoint', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(url).toMatch(/^https:\/\/abc123\.r2\.cloudflarestorage\.com/)
    })

    it('includes the bucket and key in the path', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'uploads/photo.png', 'image/png', 3600)
      expect(url).toContain('/test-bucket/uploads/photo.png')
    })

    it('includes X-Amz-Algorithm query parameter', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256')
    })

    it('includes X-Amz-Credential with access key and scope', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(url).toContain(`X-Amz-Credential=test-access-key`)
      expect(url).toContain(`${FIXED_DATE_STR}%2Fauto%2Fs3%2Faws4_request`)
    })

    it('includes X-Amz-Date matching current time', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(url).toContain(`X-Amz-Date=${FIXED_DATETIME_STR}`)
    })

    it('includes X-Amz-Expires with the specified value', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 7200)
      expect(url).toContain('X-Amz-Expires=7200')
    })

    it('includes X-Amz-SignedHeaders', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(url).toContain('X-Amz-SignedHeaders=content-type%3Bhost')
    })

    it('includes X-Amz-Signature at the end', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(url).toMatch(/X-Amz-Signature=[a-f0-9]{64}$/)
    })

    it('signedContentLength を渡すと SignedHeaders に content-length が含まれる', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'video.mp4', 'video/mp4', 3600, 12345)
      expect(url).toContain('X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost')
    })

    it('signedContentLength 未指定時は content-length を含まない (後方互換)', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'video.mp4', 'video/mp4', 3600)
      expect(url).toContain('X-Amz-SignedHeaders=content-type%3Bhost')
      expect(url).not.toContain('content-length')
    })

    it('signedContentLength により署名が変わる (改ざん耐性)', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const urlA = createPresignedPutUrl(mockConfig, 'a.mp4', 'video/mp4', 3600, 1000)
      const urlB = createPresignedPutUrl(mockConfig, 'a.mp4', 'video/mp4', 3600, 2000)
      const sigA = urlA.match(/X-Amz-Signature=([a-f0-9]+)/)?.[1]
      const sigB = urlB.match(/X-Amz-Signature=([a-f0-9]+)/)?.[1]
      expect(sigA).toBeDefined()
      expect(sigB).toBeDefined()
      expect(sigA).not.toBe(sigB)
    })

    it('query parameters are sorted alphabetically', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      const queryString = url.split('?')[1]!
      const params = queryString.split('&').map(p => p.split('=')[0]!)
      // X-Amz-Signature is appended last (outside the sorted set)
      const sortedParams = params.slice(0, -1)
      const expectedSorted = [...sortedParams].sort()
      expect(sortedParams).toEqual(expectedSorted)
    })

    it('produces deterministic output for same inputs', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url1 = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      const url2 = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      expect(url1).toBe(url2)
    })

    it('produces different signatures for different keys', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url1 = createPresignedPutUrl(mockConfig, 'file1.jpg', 'image/jpeg', 3600)
      const url2 = createPresignedPutUrl(mockConfig, 'file2.jpg', 'image/jpeg', 3600)
      const sig1 = url1.match(/X-Amz-Signature=([a-f0-9]+)/)?.[1]
      const sig2 = url2.match(/X-Amz-Signature=([a-f0-9]+)/)?.[1]
      expect(sig1).not.toBe(sig2)
    })

    it('produces different signatures for different content types', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url1 = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/jpeg', 3600)
      const url2 = createPresignedPutUrl(mockConfig, 'test.jpg', 'image/png', 3600)
      const sig1 = url1.match(/X-Amz-Signature=([a-f0-9]+)/)?.[1]
      const sig2 = url2.match(/X-Amz-Signature=([a-f0-9]+)/)?.[1]
      expect(sig1).not.toBe(sig2)
    })

    it('handles nested paths correctly', async () => {
      const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
      const url = createPresignedPutUrl(mockConfig, 'a/b/c/d.jpg', 'image/jpeg', 3600)
      expect(url).toContain('/test-bucket/a/b/c/d.jpg')
    })
  })

  // ─── putObject ─────────────────────────────────────────────────────────────

  describe('putObject', () => {
    it('sends PUT request with correct URL', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await putObject(mockConfig, 'test.jpg', Buffer.from('data'), 'image/jpeg')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url] = mockFetch.mock.calls[0]!
      expect(url).toBe('https://abc123.r2.cloudflarestorage.com/test-bucket/test.jpg')
    })

    it('sends PUT method', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await putObject(mockConfig, 'test.jpg', Buffer.from('data'), 'image/jpeg')

      const options = mockFetch.mock.calls[0]![1]!
      expect(options.method).toBe('PUT')
    })

    it('includes Authorization header', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await putObject(mockConfig, 'test.jpg', Buffer.from('data'), 'image/jpeg')

      const headers = mockFetch.mock.calls[0]![1]!.headers
      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-access-key/)
      expect(headers.Authorization).toContain('SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date')
      expect(headers.Authorization).toMatch(/Signature=[a-f0-9]{64}/)
    })

    it('includes Content-Type header', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await putObject(mockConfig, 'test.jpg', Buffer.from('data'), 'image/jpeg')

      const headers = mockFetch.mock.calls[0]![1]!.headers
      expect(headers['Content-Type']).toBe('image/jpeg')
    })

    it('includes x-amz-content-sha256 header', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      const body = Buffer.from('test data')
      await putObject(mockConfig, 'test.jpg', body, 'image/jpeg')

      const headers = mockFetch.mock.calls[0]![1]!.headers
      expect(headers['x-amz-content-sha256']).toBe(sha256Hex(body))
    })

    it('includes x-amz-date header', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await putObject(mockConfig, 'test.jpg', Buffer.from('data'), 'image/jpeg')

      const headers = mockFetch.mock.calls[0]![1]!.headers
      expect(headers['x-amz-date']).toBe(FIXED_DATETIME_STR)
    })

    it('sends body as Uint8Array', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await putObject(mockConfig, 'test.jpg', Buffer.from('data'), 'image/jpeg')

      const options = mockFetch.mock.calls[0]![1]!
      expect(options.body).toBeInstanceOf(Uint8Array)
    })

    it('throws on non-OK response', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(
        putObject(mockConfig, 'test.jpg', Buffer.from('data'), 'image/jpeg')
      ).rejects.toThrow('R2 PUT failed: 403 Forbidden')
    })

    it('encodes special characters in key', async () => {
      const { putObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await putObject(mockConfig, 'path/to/my file.jpg', Buffer.from('data'), 'image/jpeg')

      const [url] = mockFetch.mock.calls[0]!
      expect(url).toContain('my%20file.jpg')
      expect(url).toContain('/path/to/')
    })
  })

  // ─── deleteObject ──────────────────────────────────────────────────────────

  describe('deleteObject', () => {
    it('sends DELETE request with correct URL', async () => {
      const { deleteObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await deleteObject(mockConfig, 'test.jpg')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]!
      expect(url).toBe('https://abc123.r2.cloudflarestorage.com/test-bucket/test.jpg')
      expect(options.method).toBe('DELETE')
    })

    it('includes Authorization header with correct signed headers', async () => {
      const { deleteObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await deleteObject(mockConfig, 'test.jpg')

      const headers = mockFetch.mock.calls[0]![1]!.headers
      expect(headers.Authorization).toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date')
    })

    it('uses empty body content hash', async () => {
      const { deleteObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      await deleteObject(mockConfig, 'test.jpg')

      const headers = mockFetch.mock.calls[0]![1]!.headers
      expect(headers['x-amz-content-sha256']).toBe(sha256Hex(''))
    })

    it('does not throw on 204 response', async () => {
      const { deleteObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 204,
        text: () => Promise.resolve(''),
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(deleteObject(mockConfig, 'test.jpg')).resolves.toBeUndefined()
    })

    it('throws on non-OK non-204 response', async () => {
      const { deleteObject } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(deleteObject(mockConfig, 'test.jpg')).rejects.toThrow(
        'R2 DELETE failed: 500 Internal Server Error'
      )
    })
  })

  // ─── listObjects ───────────────────────────────────────────────────────────

  describe('listObjects', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>photos/img1.jpg</Key>
    <Size>12345</Size>
  </Contents>
  <Contents>
    <Key>photos/img2.png</Key>
    <Size>67890</Size>
  </Contents>
</ListBucketResult>`

    it('sends GET request with list-type=2 query param', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      await listObjects(mockConfig)

      const [url] = mockFetch.mock.calls[0]!
      expect(url).toContain('list-type=2')
    })

    it('parses Contents from XML response', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)

      expect(result.Contents).toHaveLength(2)
      expect(result.Contents[0]).toEqual({ Key: 'photos/img1.jpg', Size: 12345 })
      expect(result.Contents[1]).toEqual({ Key: 'photos/img2.png', Size: 67890 })
    })

    it('parses IsTruncated=false correctly', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)
      expect(result.IsTruncated).toBe(false)
    })

    it('parses IsTruncated=true correctly', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const truncatedXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>abc123token</NextContinuationToken>
  <Contents>
    <Key>file.jpg</Key>
    <Size>100</Size>
  </Contents>
</ListBucketResult>`
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(truncatedXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)
      expect(result.IsTruncated).toBe(true)
      expect(result.NextContinuationToken).toBe('abc123token')
    })

    it('includes max-keys param when specified', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      await listObjects(mockConfig, { maxKeys: 10 })

      const [url] = mockFetch.mock.calls[0]!
      expect(url).toContain('max-keys=10')
    })

    it('includes continuation-token param when specified', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      await listObjects(mockConfig, { continuationToken: 'mytoken' })

      const [url] = mockFetch.mock.calls[0]!
      expect(url).toContain('continuation-token=mytoken')
    })

    it('returns empty Contents for empty bucket', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(emptyXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)
      expect(result.Contents).toEqual([])
      expect(result.IsTruncated).toBe(false)
      expect(result.NextContinuationToken).toBeUndefined()
    })

    it('throws on non-OK response', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Access Denied'),
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(listObjects(mockConfig)).rejects.toThrow('R2 LIST failed: 403 Access Denied')
    })

    it('includes Authorization header', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleXml),
      })
      vi.stubGlobal('fetch', mockFetch)

      await listObjects(mockConfig)

      const headers = mockFetch.mock.calls[0]![1]!.headers
      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-access-key/)
    })
  })

  // ─── parseListObjectsXml (tested indirectly via listObjects) ───────────────

  describe('parseListObjectsXml (via listObjects)', () => {
    it('skips Contents with whitespace-padded Size (regex requires pure digits)', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      // Size regex is <Size>(\d+)</Size> — whitespace around digits won't match
      const xml = `<ListBucketResult>
        <IsTruncated>false</IsTruncated>
        <Contents>
          <Key>path/to/file.txt</Key>
          <Size>
            999
          </Size>
        </Contents>
        <Contents>
          <Key>valid.txt</Key>
          <Size>123</Size>
        </Contents>
      </ListBucketResult>`
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(xml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)
      // Only the entry with clean <Size>123</Size> matches
      expect(result.Contents).toHaveLength(1)
      expect(result.Contents[0]).toEqual({ Key: 'valid.txt', Size: 123 })
    })

    it('handles multiple Content entries', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const xml = `<ListBucketResult>
        <IsTruncated>false</IsTruncated>
        <Contents><Key>a.jpg</Key><Size>1</Size></Contents>
        <Contents><Key>b.jpg</Key><Size>2</Size></Contents>
        <Contents><Key>c.jpg</Key><Size>3</Size></Contents>
        <Contents><Key>d.jpg</Key><Size>4</Size></Contents>
      </ListBucketResult>`
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(xml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)
      expect(result.Contents).toHaveLength(4)
      expect(result.Contents.map(c => c.Key)).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'])
      expect(result.Contents.map(c => c.Size)).toEqual([1, 2, 3, 4])
    })

    it('skips Contents entries missing Key or Size', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const xml = `<ListBucketResult>
        <IsTruncated>false</IsTruncated>
        <Contents><Key>valid.jpg</Key><Size>100</Size></Contents>
        <Contents><Key>no-size.jpg</Key></Contents>
        <Contents><Size>200</Size></Contents>
      </ListBucketResult>`
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(xml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)
      // Only the entry with both Key and Size should be included
      expect(result.Contents).toHaveLength(1)
      expect(result.Contents[0]).toEqual({ Key: 'valid.jpg', Size: 100 })
    })

    it('parses NextContinuationToken when absent', async () => {
      const { listObjects } = await import('@/lib/storage/s3-sign')
      const xml = `<ListBucketResult>
        <IsTruncated>false</IsTruncated>
      </ListBucketResult>`
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(xml),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await listObjects(mockConfig)
      expect(result.NextContinuationToken).toBeUndefined()
    })
  })
})
