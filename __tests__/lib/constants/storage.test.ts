import { describe, it, expect } from 'vitest'
import {
  STORAGE_FOLDER_POST_IMAGES,
  STORAGE_FOLDER_POST_VIDEOS,
  STORAGE_FOLDER_COMMENT_IMAGES,
  STORAGE_FOLDER_COMMENT_VIDEOS,
  STORAGE_FOLDER_AVATARS,
  STORAGE_FOLDER_HEADERS,
} from '@/lib/constants/storage'

describe('storage constants', () => {
  it('投稿メディアフォルダが正しく定義されている', () => {
    expect(STORAGE_FOLDER_POST_IMAGES).toBe('post-images')
    expect(STORAGE_FOLDER_POST_VIDEOS).toBe('post-videos')
  })

  it('コメントメディアフォルダが正しく定義されている', () => {
    expect(STORAGE_FOLDER_COMMENT_IMAGES).toBe('comment-images')
    expect(STORAGE_FOLDER_COMMENT_VIDEOS).toBe('comment-videos')
  })

  it('プロフィール画像フォルダが正しく定義されている', () => {
    expect(STORAGE_FOLDER_AVATARS).toBe('avatars')
    expect(STORAGE_FOLDER_HEADERS).toBe('headers')
  })

  it('すべてのフォルダ名が文字列である', () => {
    const folders = [
      STORAGE_FOLDER_POST_IMAGES,
      STORAGE_FOLDER_POST_VIDEOS,
      STORAGE_FOLDER_COMMENT_IMAGES,
      STORAGE_FOLDER_COMMENT_VIDEOS,
      STORAGE_FOLDER_AVATARS,
      STORAGE_FOLDER_HEADERS,
    ]
    for (const folder of folders) {
      expect(typeof folder).toBe('string')
      expect(folder.length).toBeGreaterThan(0)
    }
  })

  it('フォルダ名にスラッシュが含まれない', () => {
    const folders = [
      STORAGE_FOLDER_POST_IMAGES,
      STORAGE_FOLDER_POST_VIDEOS,
      STORAGE_FOLDER_COMMENT_IMAGES,
      STORAGE_FOLDER_COMMENT_VIDEOS,
      STORAGE_FOLDER_AVATARS,
      STORAGE_FOLDER_HEADERS,
    ]
    for (const folder of folders) {
      expect(folder).not.toContain('/')
    }
  })
})
