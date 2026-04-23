import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'
import { Link } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { useState } from 'react'

export function RightPanel() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['friend-suggestions'],
    queryFn: friendsApi.getSuggestions,
  })

  const sendRequestMutation = useMutation({
    mutationFn: friendsApi.sendRequest,
    onSuccess: (_data, userId) => {
      toast.success('Đã gửi lời mời kết bạn!')
      setDismissed(prev => new Set([...prev, userId]))
      queryClient.invalidateQueries({ queryKey: ['friend-sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const visibleSuggestions = suggestions?.filter(u => !dismissed.has(u.id)).slice(0, 5)

  return (
    <div className='flex flex-col gap-4 py-3'>

      {/* ── Gợi ý kết bạn ── */}
      <section>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-[15px] font-semibold text-slate-700'>Gợi ý kết bạn</h3>
          <Link
            to='/friends'
            className='text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline'
          >
            Xem tất cả
          </Link>
        </div>

        {isLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='flex items-center gap-3 animate-pulse'>
                <div className='h-10 w-10 rounded-full bg-slate-200 flex-shrink-0' />
                <div className='flex-1 space-y-1.5'>
                  <div className='h-3 bg-slate-200 rounded w-24' />
                  <div className='h-2.5 bg-slate-100 rounded w-32' />
                </div>
                <div className='h-7 w-16 bg-slate-100 rounded-full' />
              </div>
            ))}
          </div>
        ) : !visibleSuggestions || visibleSuggestions.length === 0 ? (
          <p className='text-sm text-slate-400 text-center py-4'>Không có gợi ý nào</p>
        ) : (
          <div className='space-y-1'>
            {visibleSuggestions.map(user => (
              <div
                key={user.id}
                className='group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 transition-colors'
              >
                {/* Avatar */}
                <Link to={`/profile/${user.id}`} className='flex-shrink-0'>
                  <Avatar src={user.avatar} name={user.displayName} size='md' />
                </Link>

                {/* Info */}
                <div className='flex-1 min-w-0'>
                  <Link
                    to={`/profile/${user.id}`}
                    className='block text-[13px] font-semibold text-slate-800 truncate hover:underline leading-tight'
                  >
                    {user.displayName}
                  </Link>
                  <p className='text-[11px] text-slate-400 truncate mt-0.5'>
                    {user.bio?.trim() || `@${user.username}`}
                  </p>
                </div>

                {/* Thêm bạn button — Facebook style pill */}
                <button
                  type='button'
                  onClick={() => sendRequestMutation.mutate(user.id)}
                  disabled={sendRequestMutation.isPending}
                  className='flex-shrink-0 rounded-full bg-primary-50 hover:bg-primary-100 text-primary-600 text-[12px] font-semibold px-3 py-1.5 transition-colors disabled:opacity-50'
                >
                  Thêm bạn
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className='border-border-light' />

      {/* ── Footer links ── */}
      <div className='text-[11px] text-slate-400 leading-relaxed'>
        <div className='flex flex-wrap gap-x-2 gap-y-1'>
          {['Quyền riêng tư', 'Điều khoản', 'Cookie', 'Trợ giúp'].map(l => (
            <a key={l} href='#' className='hover:underline hover:text-slate-600 transition-colors'>
              {l}
            </a>
          ))}
        </div>
        <p className='mt-2'>© 2024 EduSocial. Bảo lưu mọi quyền.</p>
      </div>
    </div>
  )
}
