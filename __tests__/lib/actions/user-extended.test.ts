import { vi } from 'vitest'
/**
 * Extended user action tests - uploadAvatar, uploadHeader uncovered branches
 */
 export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockUploadFile = vi.fn()
const mockValidateImageFile = vi.fn()
const mockGenerateSafeFileName = vi.fn()
vi.mock('@/lib/storage', () => ({ uploadFile: (...args: unknown[]) => mockUploadFile(...args) }))
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: (...args: unknown[]) => mockValidateImageFile(...args),
  generateSafeFileName: (...args: unknown[]) => mockGenerateSafeFileName(...args),
}))

const mockPrisma: Record<string, Record<string, unknown>> = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  follow: { findFirst: vi.fn() },
  block: { findFirst: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockValidateImageFile.mockReturnValue({ valid: true })
  mockGenerateSafeFileName.mockReturnValue('safe-name.jpg')
  mockUploadFile.mockResolvedValue({ success: true, url: '/uploaded.jpg' })
})

function makeFile(name: string, type: string, sizeBytes = 100): File {
  const file = new File(['x'], name, { type })
  if (sizeBytes > 100) Object.defineProperty(file, 'size', { value: sizeBytes })
  // Ensure arrayBuffer works in Vitest (jsdom)
  if (!file.arrayBuffer) {
    file.arrayBuffer = () => Promise.resolve(new ArrayBuffer(8))
  }
  return file
}

describe('uploadAvatar', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    const result = await uploadAvatar(fd)
    expect(result.error).toContain('認証')
  })

  it('rejects when no file', async () => {
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    const result = await uploadAvatar(fd)
    expect(result.error).toBeDefined()
  })

  it('rejects file over 4MB', async () => {
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024))
    const result = await uploadAvatar(fd)
    expect(result.error).toContain('4MB')
  })

  it('rejects invalid MIME type', async () => {
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('file.txt', 'text/plain'))
    const result = await uploadAvatar(fd)
    expect(result.error).toBeDefined()
  })

  it('rejects invalid file signature', async () => {
    mockValidateImageFile.mockReturnValue({ valid: false, error: 'Invalid signature' })
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('fake.jpg', 'image/jpeg'))
    const result = await uploadAvatar(fd)
    expect(result.error).toBeDefined()
  })

  it('rejects when validation returns no error message', async () => {
    mockValidateImageFile.mockReturnValue({ valid: false })
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('fake.jpg', 'image/jpeg'))
    const result = await uploadAvatar(fd)
    expect(result.error).toBeDefined()
  })

  it('uploads successfully', async () => {
    const { uploadAvatar } = await import('@/lib/actions/user')
    ;(mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const fd = new FormData()
    fd.append('file', makeFile('photo.jpg', 'image/jpeg'))
    const result = await uploadAvatar(fd)
    expect(result).toMatchObject({ success: true, data: { url: '/uploaded.jpg' } })
  })

  it('handles upload failure and returns generic message (no internal error leak)', async () => {
    mockUploadFile.mockResolvedValue({ success: false, error: 'Storage full' })
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('photo.jpg', 'image/jpeg'))
    const result = await uploadAvatar(fd)
    expect(result.error).toBeDefined()
    expect(result.error).toBe('アップロードに失敗しました')
  })

  it('handles upload returning no url', async () => {
    mockUploadFile.mockResolvedValue({ success: true, url: null })
    const { uploadAvatar } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('photo.jpg', 'image/jpeg'))
    const result = await uploadAvatar(fd)
    expect(result.error).toBeDefined()
  })
})

describe('uploadHeader', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { uploadHeader } = await import('@/lib/actions/user')
    const fd = new FormData()
    const result = await uploadHeader(fd)
    expect(result.error).toContain('認証')
  })

  it('rejects when no file', async () => {
    const { uploadHeader } = await import('@/lib/actions/user')
    const fd = new FormData()
    const result = await uploadHeader(fd)
    expect(result.error).toBeDefined()
  })

  it('rejects file over 4MB', async () => {
    const { uploadHeader } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('big.jpg', 'image/jpeg', 5 * 1024 * 1024))
    const result = await uploadHeader(fd)
    expect(result.error).toContain('4MB')
  })

  it('rejects invalid MIME type', async () => {
    const { uploadHeader } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('file.gif', 'image/gif'))
    const result = await uploadHeader(fd)
    expect(result.error).toBeDefined()
  })

  it('rejects invalid file signature', async () => {
    mockValidateImageFile.mockReturnValue({ valid: false, error: 'Bad' })
    const { uploadHeader } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('fake.jpg', 'image/jpeg'))
    const result = await uploadHeader(fd)
    expect(result.error).toBeDefined()
  })

  it('uploads header successfully', async () => {
    const { uploadHeader } = await import('@/lib/actions/user')
    ;(mockPrisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const fd = new FormData()
    fd.append('file', makeFile('header.png', 'image/png'))
    const result = await uploadHeader(fd)
    expect(result).toMatchObject({ success: true, data: { url: '/uploaded.jpg' } })
  })

  it('handles upload failure and returns generic message (no internal error leak)', async () => {
    mockUploadFile.mockResolvedValue({ success: false, error: 'Storage full' })
    const { uploadHeader } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('header.jpg', 'image/jpeg'))
    const result = await uploadHeader(fd)
    expect(result.error).toBeDefined()
    expect(result.error).toBe('アップロードに失敗しました')
  })

  it('handles upload returning no url', async () => {
    mockUploadFile.mockResolvedValue({ success: true, url: null })
    const { uploadHeader } = await import('@/lib/actions/user')
    const fd = new FormData()
    fd.append('file', makeFile('header.jpg', 'image/jpeg'))
    const result = await uploadHeader(fd)
    expect(result.error).toBeDefined()
  })
})
