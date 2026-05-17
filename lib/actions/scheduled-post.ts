/**
 * 予約投稿機能のServer Actions（バレル再エクスポート）
 *
 * 実装は以下に分割:
 * - scheduled-post-crud.ts    : createScheduledPost, getScheduledPosts,
 *                               getScheduledPost, updateScheduledPost,
 *                               deleteScheduledPost, cancelScheduledPost
 * - scheduled-post-publish.ts : publishScheduledPosts（cron/バッチ処理）
 *
 * @module lib/actions/scheduled-post
 */

'use server'

import {
  createScheduledPost as _createScheduledPost,
  getScheduledPosts as _getScheduledPosts,
  getScheduledPost as _getScheduledPost,
  updateScheduledPost as _updateScheduledPost,
  deleteScheduledPost as _deleteScheduledPost,
  cancelScheduledPost as _cancelScheduledPost,
} from './scheduled-post-crud'
import { publishScheduledPosts as _publishScheduledPosts } from './scheduled-post-publish'

export async function createScheduledPost(formData: FormData) {
  return _createScheduledPost(formData)
}

export async function getScheduledPosts() {
  return _getScheduledPosts()
}

export async function getScheduledPost(id: string) {
  return _getScheduledPost(id)
}

export async function updateScheduledPost(id: string, formData: FormData) {
  return _updateScheduledPost(id, formData)
}

export async function deleteScheduledPost(id: string) {
  return _deleteScheduledPost(id)
}

export async function cancelScheduledPost(id: string) {
  return _cancelScheduledPost(id)
}

export async function publishScheduledPosts(cronSecret?: string) {
  return _publishScheduledPosts(cronSecret)
}
