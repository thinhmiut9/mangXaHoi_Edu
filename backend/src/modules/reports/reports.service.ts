import { reportsRepository } from './reports.repository'
import { CreateReportDto } from './reports.schema'
import { postsRepository } from '../posts/posts.repository'
import { postsService } from '../posts/posts.service'
import { commentsRepository } from '../comments/comments.repository'
import { usersRepository } from '../users/users.repository'
import { notificationsService } from '../notifications/notifications.service'
import { forceLogoutUser } from '../../socket'
import { documentsService } from '../documents/documents.service'

type ResolveAction = 'MARK_ONLY' | 'HIDE_CONTENT' | 'LOCK_24H' | 'LOCK_7D'

export const reportsService = {
  async createReport(userId: string, dto: CreateReportDto) {
    return reportsRepository.create({ reporterId: userId, ...dto })
  },

  async listReports(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [reports, total] = await Promise.all([
      reportsRepository.list(status, skip, limit),
      reportsRepository.count(status),
    ])
    return { reports, total }
  },

  async getReportDetail(id: string) {
    return reportsRepository.getById(id)
  },

  async updateStatus(
    id: string,
    payload: { status: 'RESOLVED' | 'REJECTED'; action?: ResolveAction; note?: string; notifyReporter?: boolean },
    adminUserId: string
  ) {
    const action: ResolveAction = payload.action ?? 'MARK_ONLY'
    const report = await reportsRepository.getById(id)

    const targetType = String(report?.target?.targetType || report?.targetType || '').toUpperCase()
    const targetId = report?.target?.targetId || report?.targetId || undefined
    let targetOwnerId: string | undefined =
      targetType === 'USER'
        ? targetId
        : report?.target?.author?.userId || undefined

    if (!targetOwnerId && targetId && targetType === 'POST') {
      targetOwnerId = (await postsRepository.getAuthorId(targetId)) || undefined
    }
    if (!targetOwnerId && targetId && targetType === 'COMMENT') {
      targetOwnerId = (await commentsRepository.getCommentAuthorId(targetId)) || undefined
    }
    if (!targetOwnerId && targetId && targetType === 'DOCUMENT') {
      targetOwnerId = report?.target?.author?.userId || undefined
    }

    if (payload.status === 'RESOLVED') {
      if (action === 'HIDE_CONTENT') {
        if (targetId && targetType === 'POST') {
          await postsService.deletePost(targetId, adminUserId, 'ADMIN')
        }
        if (targetId && targetType === 'COMMENT') {
          await commentsRepository.delete(targetId)
        }
        if (targetId && targetType === 'DOCUMENT') {
          await documentsService.deleteAsAdmin(targetId)
        }
      }

      if (targetOwnerId && (action === 'LOCK_24H' || action === 'LOCK_7D')) {
        const lockHours = action === 'LOCK_24H' ? 24 : 24 * 7
        const blockedUntil = await usersRepository.blockForDuration(targetOwnerId, lockHours)
        forceLogoutUser(targetOwnerId, {
          reason: 'ACCOUNT_BLOCKED',
          blockedUntil,
        })
      }
    }

    await reportsRepository.updateStatus(id, payload.status, {
      resolvedBy: adminUserId,
      action,
      note: payload.note,
    })

    if (payload.status === 'RESOLVED' && payload.notifyReporter && report?.reporter?.userId) {
      await notificationsService.push({
        recipientId: report.reporter.userId,
        senderId: adminUserId,
        type: 'ADMIN_ACTION',
        entityId: report.reportId,
        entityType: 'REPORT',
        content: `Báo cáo #${report.reportId?.slice(0, 8) ?? ''} đã được xử lý.`,
      })
    }

    if (payload.status === 'RESOLVED' && targetOwnerId) {
      await notificationsService.push({
        recipientId: targetOwnerId,
        senderId: adminUserId,
        type: 'ADMIN_ACTION',
        entityId: targetId,
        entityType: targetType || 'OTHER',
        content:
          action === 'HIDE_CONTENT'
            ? 'Nội dung của bạn đã bị xóa do vi phạm.'
            : action === 'LOCK_24H'
              ? 'Tài khoản của bạn đã bị khóa 24 giờ do vi phạm.'
              : action === 'LOCK_7D'
                ? 'Tài khoản của bạn đã bị khóa 7 ngày do vi phạm.'
                : 'Nội dung của bạn đã bị đánh dấu vi phạm và đã được xử lý.',
      })
    }
  },
}

