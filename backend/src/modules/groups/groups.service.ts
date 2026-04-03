import { v4 as uuidv4 } from 'uuid'
import { groupsRepository } from './groups.repository'
import { AppError } from '../../middleware/errorHandler'
import { CreateGroupDto, UpdateGroupDto } from './groups.schema'
import { notificationsService } from '../notifications/notifications.service'

export const groupsService = {
  async list(viewerId: string, page = 1, limit = 20) {
    return groupsRepository.list(viewerId, (page - 1) * limit, limit)
  },

  async getMyGroups(userId: string) {
    return groupsRepository.getMyGroups(userId)
  },

  async getGroup(groupId: string, viewerId?: string) {
    const group = await groupsRepository.findById(groupId, viewerId)
    if (!group) throw new AppError('Nhóm không tồn tại', 404, 'GROUP_NOT_FOUND')
    return group
  },

  async createGroup(userId: string, dto: CreateGroupDto) {
    return groupsRepository.create({ groupId: uuidv4(), ...dto, ownerId: userId })
  },

  async updateGroup(groupId: string, userId: string, dto: UpdateGroupDto) {
    const isOwner = await groupsRepository.isOwner(groupId, userId)
    if (!isOwner) throw new AppError('Chỉ chủ nhóm mới có thể chỉnh sửa', 403, 'FORBIDDEN')
    return groupsRepository.update(groupId, dto)
  },

  async joinGroup(groupId: string, userId: string): Promise<{ status: 'JOINED' | 'REQUESTED' }> {
    const group = await groupsRepository.findById(groupId)
    if (!group) throw new AppError('Nhóm không tồn tại', 404, 'GROUP_NOT_FOUND')

    const isMember = await groupsRepository.isMember(groupId, userId)
    if (isMember) throw new AppError('Đã là thành viên', 409, 'ALREADY_MEMBER')

    if (group.privacy === 'PRIVATE') {
      const alreadyRequested = await groupsRepository.isJoinRequested(groupId, userId)
      if (alreadyRequested) {
        return { status: 'REQUESTED' }
      }
      await groupsRepository.requestJoin(groupId, userId)
      const ownerId = await groupsRepository.getOwnerId(groupId)
      if (ownerId) {
        await notificationsService.push({
          recipientId: ownerId,
          senderId: userId,
          type: 'GROUP_REQUEST',
          content: 'đã gửi yêu cầu tham gia nhóm của bạn.',
        })
      }
      return { status: 'REQUESTED' }
    }

    await groupsRepository.join(groupId, userId)
    return { status: 'JOINED' }
  },

  async leaveGroup(groupId: string, userId: string) {
    const isOwner = await groupsRepository.isOwner(groupId, userId)
    if (isOwner) throw new AppError('Chủ nhóm không thể rời nhóm. Hãy chuyển quyền trước.', 400)
    await groupsRepository.leave(groupId, userId)
  },

  async getMembers(groupId: string, page = 1, limit = 20) {
    return groupsRepository.getMembers(groupId, (page - 1) * limit, limit)
  },

  async getJoinRequests(groupId: string, ownerId: string, page = 1, limit = 20) {
    const isOwner = await groupsRepository.isOwner(groupId, ownerId)
    if (!isOwner) throw new AppError('Chỉ chủ nhóm mới có thể xem yêu cầu duyệt', 403, 'FORBIDDEN')

    const rows = await groupsRepository.getJoinRequests(groupId, (page - 1) * limit, limit)
    return rows.map((row) => ({
      requester: row.requester.properties,
      requestedAt: row.requestedAt,
    }))
  },

  async approveJoinRequest(groupId: string, ownerId: string, requesterId: string) {
    const isOwner = await groupsRepository.isOwner(groupId, ownerId)
    if (!isOwner) throw new AppError('Chỉ chủ nhóm mới có thể duyệt yêu cầu', 403, 'FORBIDDEN')

    const alreadyMember = await groupsRepository.isMember(groupId, requesterId)
    if (alreadyMember) throw new AppError('Người dùng đã là thành viên', 409, 'ALREADY_MEMBER')

    const requested = await groupsRepository.isJoinRequested(groupId, requesterId)
    if (!requested) throw new AppError('Không tìm thấy yêu cầu tham gia', 404, 'JOIN_REQUEST_NOT_FOUND')

    await groupsRepository.approveJoinRequest(groupId, requesterId)
    await notificationsService.push({
      recipientId: requesterId,
      senderId: ownerId,
      type: 'GROUP_INVITE',
      content: 'đã duyệt yêu cầu tham gia nhóm của bạn.',
    })
  },

  async rejectJoinRequest(groupId: string, ownerId: string, requesterId: string) {
    const isOwner = await groupsRepository.isOwner(groupId, ownerId)
    if (!isOwner) throw new AppError('Chỉ chủ nhóm mới có thể từ chối yêu cầu', 403, 'FORBIDDEN')

    const requested = await groupsRepository.isJoinRequested(groupId, requesterId)
    if (!requested) throw new AppError('Không tìm thấy yêu cầu tham gia', 404, 'JOIN_REQUEST_NOT_FOUND')

    await groupsRepository.rejectJoinRequest(groupId, requesterId)
  },
}
