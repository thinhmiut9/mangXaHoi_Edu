import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { Modal } from '@/components/ui/Modal'

interface AdminUserRow {
  userId: string
  displayName: string
  email: string
  bio?: string
  location?: string
  role?: 'USER' | 'ADMIN'
  status?: 'ACTIVE' | 'BLOCKED'
  createdAt?: string
  updatedAt?: string
  blockedUntil?: string
}

interface AdminUserDetail extends AdminUserRow {
  profileVisibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  lastOnlineAt?: string
  postsCount?: number
  friendsCount?: number
  groupsCount?: number
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const numeric = Number(value)
  const dateFromValue = Number.isFinite(numeric) && String(value).trim() !== '' ? new Date(numeric) : new Date(value)
  if (Number.isNaN(dateFromValue.getTime())) return '-'
  return dateFromValue.toLocaleString('vi-VN')
}

function visibilityLabel(value?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE') {
  if (value === 'PUBLIC') return 'Công khai'
  if (value === 'FRIENDS') return 'Bạn bè'
  if (value === 'PRIVATE') return 'Riêng tư'
  return '-'
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: users, isLoading } = useQuery<AdminUserRow[]>({
    queryKey: ['admin-users-page', search],
    queryFn: () => adminApi.listUsers(1, search || undefined, 100),
  })

  const detailQuery = useQuery<AdminUserDetail>({
    queryKey: ['admin-user-detail', selectedUserId],
    queryFn: () => adminApi.getUserDetail(String(selectedUserId)),
    enabled: !!selectedUserId,
  })

  const blockMutation = useMutation({
    mutationFn: (payload: { id: string }) => adminApi.blockUser(payload.id),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users-page'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      if (selectedUserId === payload.id) {
        queryClient.invalidateQueries({ queryKey: ['admin-user-detail', payload.id] })
      }
      toast.success('Đã khóa tài khoản')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const unblockMutation = useMutation({
    mutationFn: (payload: { id: string }) => adminApi.unblockUser(payload.id),
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users-page'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      if (selectedUserId === payload.id) {
        queryClient.invalidateQueries({ queryKey: ['admin-user-detail', payload.id] })
      }
      toast.success('Đã mở khóa tài khoản')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const filtered = useMemo(
    () => (users ?? []).filter((u) => u.role !== 'ADMIN'),
    [users]
  )

  const closeDetail = () => setSelectedUserId(null)

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Quản lý người dùng</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc email"
          className="h-10 w-[320px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Tên</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Ngày tạo</th>
              <th className="px-4 py-3 text-left">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isBlocking = blockMutation.isPending && blockMutation.variables?.id === u.userId
              const isUnblocking = unblockMutation.isPending && unblockMutation.variables?.id === u.userId
              return (
                <tr key={u.userId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-700">{u.displayName}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.status === 'BLOCKED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {u.status === 'BLOCKED' ? 'Bị khóa' : 'Đang hoạt động'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        onClick={() => setSelectedUserId(u.userId)}
                      >
                        Chi tiết
                      </button>

                      {u.status === 'BLOCKED' ? (
                        <button
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-emerald-300"
                          onClick={() => unblockMutation.mutate({ id: u.userId })}
                          disabled={isUnblocking || isBlocking}
                        >
                          {isUnblocking ? 'Đang mở...' : 'Mở khóa'}
                        </button>
                      ) : (
                        <button
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-rose-300"
                          onClick={() => blockMutation.mutate({ id: u.userId })}
                          disabled={isBlocking || isUnblocking}
                        >
                          {isBlocking ? 'Đang khóa...' : 'Khóa'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Không có người dùng phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selectedUserId}
        onClose={closeDetail}
        title="Chi tiết tài khoản người dùng"
        size="xl"
        footer={
          <>
            <button
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={closeDetail}
            >
              Đóng
            </button>
            {detailQuery.data?.status === 'BLOCKED' ? (
              <button
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-emerald-300"
                onClick={() => detailQuery.data?.userId && unblockMutation.mutate({ id: detailQuery.data.userId })}
                disabled={unblockMutation.isPending}
              >
                Mở khóa tài khoản
              </button>
            ) : (
              <button
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-rose-300"
                onClick={() => detailQuery.data?.userId && blockMutation.mutate({ id: detailQuery.data.userId })}
                disabled={blockMutation.isPending}
              >
                Khóa tài khoản
              </button>
            )}
          </>
        }
      >
        {detailQuery.isLoading && (
          <p className="text-sm text-slate-500">Đang tải chi tiết người dùng...</p>
        )}

        {detailQuery.isError && (
          <p className="text-sm text-rose-600">{extractError(detailQuery.error)}</p>
        )}

        {detailQuery.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Họ tên</p>
                <p className="text-base font-semibold text-slate-800">{detailQuery.data.displayName || '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-base font-semibold text-slate-800">{detailQuery.data.email || '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Vai trò</p>
                <p className="text-base font-semibold text-slate-800">{detailQuery.data.role || '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Trạng thái</p>
                <p className={`text-base font-semibold ${detailQuery.data.status === 'BLOCKED' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {detailQuery.data.status === 'BLOCKED' ? 'Bị khóa' : 'Đang hoạt động'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Số bài viết</p>
                <p className="text-lg font-bold text-slate-800">{detailQuery.data.postsCount ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Bạn bè</p>
                <p className="text-lg font-bold text-slate-800">{detailQuery.data.friendsCount ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Nhóm tham gia</p>
                <p className="text-lg font-bold text-slate-800">{detailQuery.data.groupsCount ?? 0}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-1 text-xs text-slate-500">Bio</p>
              <p className="text-sm text-slate-700">{detailQuery.data.bio || 'Chưa cập nhật bio.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Vị trí</p>
                <p className="text-sm font-medium text-slate-700">{detailQuery.data.location || '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Hiển thị hồ sơ</p>
                <p className="text-sm font-medium text-slate-700">{visibilityLabel(detailQuery.data.profileVisibility)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Ngày tạo</p>
                <p className="text-sm font-medium text-slate-700">{formatDateTime(detailQuery.data.createdAt)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Cập nhật gần nhất</p>
                <p className="text-sm font-medium text-slate-700">{formatDateTime(detailQuery.data.updatedAt)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Hoạt động gần nhất</p>
                <p className="text-sm font-medium text-slate-700">{formatDateTime(detailQuery.data.lastOnlineAt)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Bị khóa đến</p>
                <p className="text-sm font-medium text-slate-700">{formatDateTime(detailQuery.data.blockedUntil)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

