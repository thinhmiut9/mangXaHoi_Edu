import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { UserCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { Link, useNavigate } from 'react-router-dom'
import { User } from '@/api/auth'
import { connectSocket } from '@/socket/socketClient'
import { useAuthStore } from '@/store/authStore'
import { chatApi } from '@/api/index'

type UserCardAction = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  loading?: boolean
}

function UserCard({ user, actions, online }: { user: User; actions: UserCardAction[]; online?: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow-card border border-border-light p-3 flex items-center gap-3">
      <Link to={`/profile/${user.id}`}>
        <Avatar src={user.avatar} name={user.displayName} size="md" online={online} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/profile/${user.id}`} className="text-sm font-semibold text-text-primary hover:underline block truncate">
          {user.displayName}
        </Link>
        <p className="text-xs text-text-secondary truncate">{user.bio || `@${user.username}`}</p>
        {online !== undefined && (
          <p className={`text-xs mt-0.5 ${online ? 'text-success-500' : 'text-text-muted'}`}>
            {online ? 'Đang hoạt động' : 'Không hoạt động'}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {actions.map(action => (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant ?? 'primary'}
            onClick={action.onClick}
            loading={action.loading}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default function FriendsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])

  const { data: requests, isLoading: requestsLoading } = useQuery({ queryKey: ['friend-requests'], queryFn: friendsApi.getRequests })
  const { data: sentRequests, isLoading: sentLoading } = useQuery({ queryKey: ['friend-sent-requests'], queryFn: friendsApi.getSentRequests })
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({ queryKey: ['friend-suggestions'], queryFn: friendsApi.getSuggestions })
  const { data: friends, isLoading: friendsLoading } = useQuery({ queryKey: ['friends'], queryFn: friendsApi.getFriends })

  useEffect(() => {
    if (!token) return
    const socket = connectSocket(token)

    const onOnlineList = (payload: { userIds?: string[] }) => setOnlineUsers(payload.userIds ?? [])
    const onUserOnline = ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => (prev.includes(userId) ? prev : [...prev, userId]))
    }
    const onUserOffline = ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId))
    }

    socket.on('online-users', onOnlineList)
    socket.on('user-online', onUserOnline)
    socket.on('user-offline', onUserOffline)

    return () => {
      socket.off('online-users', onOnlineList)
      socket.off('user-online', onUserOnline)
      socket.off('user-offline', onUserOffline)
    }
  }, [token])

  const onlineSet = useMemo(() => new Set(onlineUsers), [onlineUsers])

  const acceptMutation = useMutation({
    mutationFn: friendsApi.acceptRequest,
    onSuccess: () => {
      toast.success('Đã chấp nhận lời mời!')
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: friendsApi.rejectRequest,
    onSuccess: () => {
      toast.success('Đã từ chối lời mời')
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const addMutation = useMutation({
    mutationFn: friendsApi.sendRequest,
    onSuccess: () => {
      toast.success('Đã gửi lời mời kết bạn!')
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: friendsApi.cancelRequest,
    onSuccess: () => {
      toast.success('Đã thu hồi lời mời')
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const unfriendMutation = useMutation({
    mutationFn: friendsApi.unfriend,
    onSuccess: () => {
      toast.success('Đã hủy kết bạn')
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const openConversationMutation = useMutation({
    mutationFn: (targetId: string) => chatApi.getOrCreateConversation(targetId),
    onSuccess: (conversation) => {
      navigate(`/chat/${conversation.id}`)
    },
    onError: (err) => toast.error(extractError(err)),
  })

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-text-primary mb-3">Lời mời kết bạn {requests && requests.length > 0 && `(${requests.length})`}</h2>
        {requestsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 2 }).map((_, i) => <UserCardSkeleton key={i} />)}</div>
        ) : !requests?.length ? (
          <EmptyState title="Không có lời mời nào" icon={<span className="text-2xl">👋</span>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {requests.map(u => (
              <UserCard
                key={u.id}
                user={u}
                actions={[
                  { label: 'Chấp nhận', onClick: () => acceptMutation.mutate(u.id), loading: acceptMutation.isPending },
                  { label: 'Từ chối', onClick: () => rejectMutation.mutate(u.id), variant: 'secondary' },
                ]}
                online={onlineSet.has(u.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-primary mb-3">Lời mời đã gửi {sentRequests && sentRequests.length > 0 && `(${sentRequests.length})`}</h2>
        {sentLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 2 }).map((_, i) => <UserCardSkeleton key={i} />)}</div>
        ) : !sentRequests?.length ? (
          <EmptyState title="Chưa gửi lời mời nào" icon={<span className="text-2xl">📭</span>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sentRequests.map(u => (
              <UserCard
                key={u.id}
                user={u}
                actions={[
                  { label: 'Thu hồi', onClick: () => cancelMutation.mutate(u.id), variant: 'secondary', loading: cancelMutation.isPending },
                ]}
                online={onlineSet.has(u.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-primary mb-3">Những người bạn có thể biết</h2>
        {suggestionsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <UserCardSkeleton key={i} />)}</div>
        ) : !suggestions?.length ? (
          <EmptyState title="Không có gợi ý nào" icon={<span className="text-2xl">🔍</span>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestions.map(u => (
              <UserCard
                key={u.id}
                user={u}
                actions={[
                  { label: 'Thêm bạn', onClick: () => addMutation.mutate(u.id), variant: 'secondary' },
                ]}
                online={onlineSet.has(u.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-text-primary mb-3">Bạn bè {friends && `(${friends.length})`}</h2>
        {friendsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <UserCardSkeleton key={i} />)}</div>
        ) : !friends?.length ? (
          <EmptyState title="Chưa có bạn bè" description="Kết bạn với mọi người để bắt đầu!" icon={<span className="text-2xl">👥</span>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {friends.map(u => (
              <UserCard
                key={u.id}
                user={u}
                actions={[
                  { label: 'Nhắn tin', onClick: () => openConversationMutation.mutate(u.id), variant: 'ghost', loading: openConversationMutation.isPending },
                  { label: 'Hủy kết bạn', onClick: () => unfriendMutation.mutate(u.id), variant: 'secondary', loading: unfriendMutation.isPending },
                ]}
                online={onlineSet.has(u.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
