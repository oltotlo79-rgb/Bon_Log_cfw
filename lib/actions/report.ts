/**
 * 通報機能のServer Actions（バレル再エクスポート）
 *
 * 実装は以下のサブファイルに分割されている:
 * - report-user.ts   : createReport（一般ユーザー向け、自動非表示含む）
 * - report-admin.ts  : getReports, updateReportStatus, deleteReportedContent,
 *                      deleteReport, getReportStats（管理者向け）
 *
 * @module lib/actions/report
 */

'use server'

import { createReport as _createReport, type CreateReportParams } from './report-user'
import {
  getReports as _getReports,
  updateReportStatus as _updateReportStatus,
  deleteReportedContent as _deleteReportedContent,
  deleteReport as _deleteReport,
  getReportStats as _getReportStats,
} from './report-admin'
import type { ReportTargetType, ReportStatus } from '@/lib/constants/report'

export async function createReport(params: CreateReportParams) {
  return _createReport(params)
}

export async function getReports(options?: {
  status?: ReportStatus
  targetType?: ReportTargetType
  limit?: number
  cursor?: string
}) {
  return _getReports(options)
}

export async function updateReportStatus(reportId: string, status: ReportStatus, note?: string) {
  return _updateReportStatus(reportId, status, note)
}

export async function deleteReportedContent(targetType: ReportTargetType, targetId: string) {
  return _deleteReportedContent(targetType, targetId)
}

export async function deleteReport(reportId: string) {
  return _deleteReport(reportId)
}

export async function getReportStats() {
  return _getReportStats()
}
