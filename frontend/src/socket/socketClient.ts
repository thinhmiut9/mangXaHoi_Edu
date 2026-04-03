import { io, Socket } from 'socket.io-client'

const runtimeSocketUrl = `${window.location.protocol}//${window.location.hostname}:5000`
const SOCKET_URL = runtimeSocketUrl

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    console.log('🔌 Socket.IO connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.IO disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err.message)
  })

  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

// Helper: join a conversation room
export function joinConversation(conversationId: string): void {
  socket?.emit('join-conversation', conversationId)
}

export function leaveConversation(conversationId: string): void {
  socket?.emit('leave-conversation', conversationId)
}

export function emitTyping(conversationId: string, displayName: string): void {
  socket?.emit('typing', { conversationId, displayName })
}

export function emitStopTyping(conversationId: string): void {
  socket?.emit('stop-typing', { conversationId })
}

export function emitNewMessage(conversationId: string, message: unknown): void {
  socket?.emit('new-message', { conversationId, message })
}

export function emitCallOffer(payload: { toUserId: string; conversationId: string; offer: RTCSessionDescriptionInit }): void {
  socket?.emit('call:offer', payload)
}

export function emitCallAnswer(payload: { toUserId: string; conversationId: string; answer: RTCSessionDescriptionInit }): void {
  socket?.emit('call:answer', payload)
}

export function emitCallIceCandidate(payload: { toUserId: string; conversationId: string; candidate: RTCIceCandidateInit }): void {
  socket?.emit('call:ice-candidate', payload)
}

export function emitCallReject(payload: { toUserId: string; conversationId: string }): void {
  socket?.emit('call:reject', payload)
}

export function emitCallHangup(payload: { toUserId: string; conversationId: string }): void {
  socket?.emit('call:hangup', payload)
}
