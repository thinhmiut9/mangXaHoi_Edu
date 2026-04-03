import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { JwtPayload } from '../middleware/requireAuth'

const onlineUsers = new Map<string, string>() // userId -> socketId
let ioInstance: Server | null = null

export function setupSocket(io: Server): void {
  ioInstance = io
  // Auth middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string
    if (!token) return next(new Error('Authentication required'))
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload
    const userId = user.userId

    // Register user as online
    onlineUsers.set(userId, socket.id)
    socket.join(`user:${userId}`)
    socket.emit('online-users', { userIds: Array.from(onlineUsers.keys()) })
    io.emit('user-online', { userId })
    console.log(`🔌 Socket connected: ${user.email}`)

    // Join conversation room
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`)
    })

    // Send message via socket (FE sends via HTTP, but socket broadcasts to room)
    socket.on('new-message', (data: { conversationId: string; message: unknown }) => {
      socket.to(`conversation:${data.conversationId}`).emit('new-message', data.message)
    })

    // Typing indicators
    socket.on('typing', (data: { conversationId: string; displayName: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing', {
        userId,
        displayName: data.displayName,
      })
    })

    socket.on('stop-typing', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('stop-typing', { userId })
    })

    // Message read
    socket.on('message-read', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('message-read', { userId, ...data })
    })

    // Voice/video call signaling
    socket.on(
      'call:offer',
      (data: { toUserId?: string; conversationId?: string; offer?: unknown }) => {
        if (!data?.toUserId || !data?.conversationId || !data?.offer) return
        io.to(`user:${data.toUserId}`).emit('call:offer', {
          fromUserId: userId,
          fromEmail: user.email,
          conversationId: data.conversationId,
          offer: data.offer,
        })
      }
    )

    socket.on(
      'call:answer',
      (data: { toUserId?: string; conversationId?: string; answer?: unknown }) => {
        if (!data?.toUserId || !data?.conversationId || !data?.answer) return
        io.to(`user:${data.toUserId}`).emit('call:answer', {
          fromUserId: userId,
          fromEmail: user.email,
          conversationId: data.conversationId,
          answer: data.answer,
        })
      }
    )

    socket.on(
      'call:ice-candidate',
      (data: { toUserId?: string; conversationId?: string; candidate?: unknown }) => {
        if (!data?.toUserId || !data?.conversationId || !data?.candidate) return
        io.to(`user:${data.toUserId}`).emit('call:ice-candidate', {
          fromUserId: userId,
          conversationId: data.conversationId,
          candidate: data.candidate,
        })
      }
    )

    socket.on('call:reject', (data: { toUserId?: string; conversationId?: string }) => {
      if (!data?.toUserId || !data?.conversationId) return
      io.to(`user:${data.toUserId}`).emit('call:reject', {
        fromUserId: userId,
        conversationId: data.conversationId,
      })
    })

    socket.on('call:hangup', (data: { toUserId?: string; conversationId?: string }) => {
      if (!data?.toUserId || !data?.conversationId) return
      io.to(`user:${data.toUserId}`).emit('call:hangup', {
        fromUserId: userId,
        conversationId: data.conversationId,
      })
    })

    // Disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(userId)
      io.emit('user-offline', { userId })
      console.log(`🔌 Socket disconnected: ${user.email}`)
    })
  })
}

// Helper: push notification to a user via socket
export function pushNotification(userId: string, notification: unknown): void {
  ioInstance?.to(`user:${userId}`).emit('new-notification', notification)
}

export function forceLogoutUser(userId: string, payload?: { reason?: string; blockedUntil?: string }): void {
  if (!ioInstance) return
  const room = `user:${userId}`
  ioInstance.to(room).emit('account-blocked', {
    reason: payload?.reason ?? 'ACCOUNT_BLOCKED',
    blockedUntil: payload?.blockedUntil,
  })
  ioInstance.in(room).disconnectSockets(true)
}

export function pushConversationMessage(conversationId: string, message: unknown, participantIds: string[] = []): void {
  if (!ioInstance) return

  if (participantIds.length > 0) {
    for (const userId of participantIds) {
      ioInstance.to(`user:${userId}`).emit('new-message', message)
    }
    return
  }

  ioInstance.to(`conversation:${conversationId}`).emit('new-message', message)
}

// Helper: check if user is online
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId)
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys())
}
