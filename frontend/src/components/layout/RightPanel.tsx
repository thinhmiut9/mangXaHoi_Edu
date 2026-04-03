import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { UserCardSkeleton } from '@/components/ui/Skeleton'
import { Link } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'

export function RightPanel() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['friend-suggestions'],
    queryFn: friendsApi.getSuggestions,
  })

  const sendRequestMutation = useMutation({
    mutationFn: friendsApi.sendRequest,
    onSuccess: () => {
      toast.success('Đã gửi lời mời kết bạn!')
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  return (
    <div className="flex flex-col gap-4 py-3">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text-primary">Gợi ý kết bạn</h3>
          <Link to="/friends" className="text-sm font-medium text-primary-500 hover:underline">Xem tất cả</Link>
        </div>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <UserCardSkeleton key={i} />)
        ) : suggestions?.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-4">Không có gợi ý nào</p>
        ) : (
          <div className="space-y-1">
            {suggestions?.slice(0, 5).map(user => (
              <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-hover-bg">
                <Link to={`/profile/${user.id}`}>
                  <Avatar src={user.avatar} name={user.displayName} size="md" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${user.id}`} className="text-sm font-semibold text-text-primary hover:underline truncate block">
                    {user.displayName}
                  </Link>
                  <p className="text-xs text-text-secondary truncate">{user.bio || user.username}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs px-2 h-7 flex-shrink-0"
                  onClick={() => sendRequestMutation.mutate(user.id)}
                >
                  Thêm bạn
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="border-border-light" />

      <div className="text-xs text-text-muted leading-relaxed">
        <div className="flex flex-wrap gap-x-2">
          {['Quyền riêng tư', 'Điều khoản', 'Cookie', 'Trợ giúp'].map(l => (
            <a key={l} href="#" className="hover:underline">{l}</a>
          ))}
        </div>
        <p className="mt-2">© 2024 EduSocial. Bảo lưu mọi quyền.</p>
      </div>
    </div>
  )
}
