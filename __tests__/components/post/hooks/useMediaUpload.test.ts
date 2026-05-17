import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock dependencies
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  isVideoFile: vi.fn().mockReturnValue(false),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn(),
}))

import { useMediaUpload } from '@/components/post/hooks/useMediaUpload'

describe('useMediaUpload', () => {
  const mockOnError = vi.fn()
  const defaultParams = {
    maxImages: 4,
    maxVideos: 1,
    onError: mockOnError,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初期状態が正しいこと', () => {
    const { result } = renderHook(() => useMediaUpload(defaultParams))

    expect(result.current.mediaFiles).toEqual([])
    expect(result.current.uploading).toBe(false)
    expect(result.current.uploadProgress).toBe(0)
  })

  it('fileInputRefが初期化されていること', () => {
    const { result } = renderHook(() => useMediaUpload(defaultParams))

    expect(result.current.fileInputRef).toBeDefined()
    expect(result.current.fileInputRef.current).toBeNull()
  })

  it('removeMediaが指定したインデックスのファイルを削除すること', () => {
    const { result } = renderHook(() => useMediaUpload(defaultParams))

    // setMediaFilesで直接ファイルを設定
    act(() => {
      result.current.setMediaFiles([
        { url: '/image1.jpg', type: 'image' },
        { url: '/image2.jpg', type: 'image' },
        { url: '/image3.jpg', type: 'image' },
      ])
    })

    expect(result.current.mediaFiles).toHaveLength(3)

    // インデックス1のファイルを削除
    act(() => {
      result.current.removeMedia(1)
    })

    expect(result.current.mediaFiles).toHaveLength(2)
    expect(result.current.mediaFiles[0].url).toBe('/image1.jpg')
    expect(result.current.mediaFiles[1].url).toBe('/image3.jpg')
  })

  it('removeMediaで最初のファイルを削除できること', () => {
    const { result } = renderHook(() => useMediaUpload(defaultParams))

    act(() => {
      result.current.setMediaFiles([
        { url: '/image1.jpg', type: 'image' },
        { url: '/image2.jpg', type: 'image' },
      ])
    })

    act(() => {
      result.current.removeMedia(0)
    })

    expect(result.current.mediaFiles).toHaveLength(1)
    expect(result.current.mediaFiles[0].url).toBe('/image2.jpg')
  })

  it('removeMediaで最後のファイルを削除できること', () => {
    const { result } = renderHook(() => useMediaUpload(defaultParams))

    act(() => {
      result.current.setMediaFiles([
        { url: '/image1.jpg', type: 'image' },
        { url: '/image2.jpg', type: 'image' },
      ])
    })

    act(() => {
      result.current.removeMedia(1)
    })

    expect(result.current.mediaFiles).toHaveLength(1)
    expect(result.current.mediaFiles[0].url).toBe('/image1.jpg')
  })

  it('アンマウント時にAbortControllerがabortされること', () => {
    const { result, unmount } = renderHook(() => useMediaUpload(defaultParams))

    // abortControllerRefにモックをセット
    const mockAbort = vi.fn()
    const mockController = { abort: mockAbort, signal: { aborted: false } } as unknown as AbortController
    result.current.abortControllerRef.current = mockController

    unmount()

    expect(mockAbort).toHaveBeenCalled()
  })

  it('abortControllerRefがnullの場合、アンマウント時にエラーが発生しないこと', () => {
    const { result, unmount } = renderHook(() => useMediaUpload(defaultParams))

    expect(result.current.abortControllerRef.current).toBeNull()

    // エラーが発生しないことを確認
    expect(() => unmount()).not.toThrow()
  })

  it('setUploadingでアップロード状態を変更できること', () => {
    const { result } = renderHook(() => useMediaUpload(defaultParams))

    act(() => {
      result.current.setUploading(true)
    })

    expect(result.current.uploading).toBe(true)

    act(() => {
      result.current.setUploading(false)
    })

    expect(result.current.uploading).toBe(false)
  })

  it('setUploadProgressでプログレスを変更できること', () => {
    const { result } = renderHook(() => useMediaUpload(defaultParams))

    act(() => {
      result.current.setUploadProgress(50)
    })

    expect(result.current.uploadProgress).toBe(50)
  })
})
