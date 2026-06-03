// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockDeleteFile = vi.fn()
vi.mock('@/lib/storage', () => ({
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mockLoggerError, debug: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deleteMediaFiles', () => {
  it('各有効 URL に対して deleteFile を呼ぶ', async () => {
    mockDeleteFile.mockResolvedValue({ success: true })
    const { deleteMediaFiles } = await import('@/lib/services/media-cleanup')

    await deleteMediaFiles(['https://cdn/a.webp', 'https://cdn/b.webp'])

    expect(mockDeleteFile).toHaveBeenCalledTimes(2)
    expect(mockDeleteFile).toHaveBeenCalledWith('https://cdn/a.webp')
    expect(mockDeleteFile).toHaveBeenCalledWith('https://cdn/b.webp')
  })

  it('null/undefined/空文字は無視する', async () => {
    mockDeleteFile.mockResolvedValue({ success: true })
    const { deleteMediaFiles } = await import('@/lib/services/media-cleanup')

    await deleteMediaFiles([null, undefined, '', 'https://cdn/c.webp'])

    expect(mockDeleteFile).toHaveBeenCalledTimes(1)
    expect(mockDeleteFile).toHaveBeenCalledWith('https://cdn/c.webp')
  })

  it('対象が無ければ deleteFile を呼ばない', async () => {
    const { deleteMediaFiles } = await import('@/lib/services/media-cleanup')

    await deleteMediaFiles([null, undefined])

    expect(mockDeleteFile).not.toHaveBeenCalled()
  })

  it('best-effort: 1件失敗しても throw せず logger.error に記録し他は続行', async () => {
    mockDeleteFile
      .mockRejectedValueOnce(new Error('R2 down'))
      .mockResolvedValueOnce({ success: true })
    const { deleteMediaFiles } = await import('@/lib/services/media-cleanup')

    await expect(deleteMediaFiles(['https://cdn/fail.webp', 'https://cdn/ok.webp'])).resolves.toBeUndefined()

    expect(mockDeleteFile).toHaveBeenCalledTimes(2)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to delete media file from storage',
      expect.objectContaining({ url: 'https://cdn/fail.webp' })
    )
  })
})
