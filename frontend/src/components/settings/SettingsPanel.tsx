import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { extractError } from '@/api/client'
import { friendsApi, usersApi } from '@/api/users'
import { useToast } from '@/components/ui/Toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuthStore } from '@/store/authStore'
import { disconnectSocket } from '@/socket/socketClient'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Mật khẩu mới phải có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Mật khẩu mới phải có ít nhất 1 chữ số'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Xác nhận mật khẩu không khớp',
  })

type FormValues = z.infer<typeof schema>
type SettingsSection = 'account' | 'privacy' | 'appearance'
type VisibilityOption = 'PUBLIC' | 'PRIVATE'
type ThemeMode = 'light' | 'dark'

const VISIBILITY_OPTIONS: Array<{ value: VisibilityOption; label: string }> = [
  { value: 'PUBLIC', label: 'Công khai' },
  { value: 'PRIVATE', label: 'Riêng tư' },
]

function PasswordToggleIcon({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10.58 10.58a2 2 0 002.83 2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9.88 5.09A10.94 10.94 0 0112 4c5 0 9.27 3.11 11 8a11.77 11.77 0 01-4.18 5.94" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M6.61 6.61A12.2 12.2 0 001 12c1.73 4.89 6 8 11 8a10.94 10.94 0 005.09-1.17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function PasswordToggleButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      className="text-text-muted hover:text-text-primary focus:outline-none"
    >
      <PasswordToggleIcon show={show} />
    </button>
  )
}

export function SettingsPanel({ inModal = false }: { inModal?: boolean }) {
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, clearAuth, updateUser } = useAuthStore()

  const [openSection, setOpenSection] = useState<SettingsSection | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const [profileVisibility, setProfileVisibility] = useState<VisibilityOption>(
    (user?.profileVisibility as VisibilityOption | undefined) ?? 'PUBLIC'
  )
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    const value = (user?.profileVisibility as VisibilityOption | undefined) ?? 'PUBLIC'
    setProfileVisibility(value)
  }, [user?.profileVisibility])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode)
    localStorage.setItem('theme-mode', themeMode)
  }, [themeMode])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  const { data: blockedUsers = [], isLoading: blockedUsersLoading } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: friendsApi.getBlockedUsers,
  })

  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công')
      reset()
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const visibilityMutation = useMutation({
    mutationFn: (visibility: VisibilityOption) => usersApi.updateProfile({ profileVisibility: visibility }),
    onSuccess: (updatedUser) => {
      updateUser({ profileVisibility: updatedUser.profileVisibility })
      toast.success('Đã cập nhật quyền riêng tư hồ sơ')
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
    onError: (err) => {
      setProfileVisibility((user?.profileVisibility as VisibilityOption | undefined) ?? 'PUBLIC')
      toast.error(extractError(err))
    },
  })

  const unblockMutation = useMutation({
    mutationFn: friendsApi.unblockUser,
    onSuccess: () => {
      toast.success('Đã bỏ chặn người dùng')
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] })
      queryClient.invalidateQueries({ queryKey: ['friend-suggestions'] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      disconnectSocket()
      clearAuth()
      navigate('/login', { replace: true })
    },
  })

  const onSubmit = (data: FormValues) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    })
  }

  const handleChangeVisibility = (value: VisibilityOption) => {
    setProfileVisibility(value)
    visibilityMutation.mutate(value)
  }

  const toggleSection = (section: SettingsSection) => {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  return (
    <div className={inModal ? 'space-y-4' : 'mx-auto max-w-4xl space-y-4'}>
      {!inModal && (
        <div className="rounded-2xl border border-border-light bg-white p-5 shadow-card">
          <h1 className="text-2xl font-bold text-slate-900">Cài đặt tài khoản</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Quản lý tài khoản, quyền riêng tư và giao diện hiển thị.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-border-light bg-white shadow-card">
        <button
          type="button"
          onClick={() => toggleSection('account')}
          className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
        >
          <h2 className="text-lg font-semibold text-slate-900">Về tài khoản</h2>
          <span className="text-xs text-text-secondary sm:text-sm">Đổi mật khẩu, đăng xuất</span>
        </button>

        {openSection === 'account' && (
          <div className="border-t border-border-light px-4 py-4 space-y-4 sm:px-5">
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Input
                label="Mật khẩu hiện tại"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.currentPassword?.message}
                fullWidth
                rightIcon={<PasswordToggleButton show={showCurrentPassword} onClick={() => setShowCurrentPassword((prev) => !prev)} />}
                {...register('currentPassword')}
              />

              <Input
                label="Mật khẩu mới"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.newPassword?.message}
                fullWidth
                rightIcon={<PasswordToggleButton show={showNewPassword} onClick={() => setShowNewPassword((prev) => !prev)} />}
                {...register('newPassword')}
              />

              <Input
                label="Xác nhận mật khẩu mới"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                fullWidth
                rightIcon={<PasswordToggleButton show={showConfirmPassword} onClick={() => setShowConfirmPassword((prev) => !prev)} />}
                {...register('confirmPassword')}
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="submit"
                  loading={changePasswordMutation.isPending || isSubmitting}
                  disabled={changePasswordMutation.isPending}
                >
                  Cập nhật mật khẩu
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setConfirmLogoutOpen(true)}
                  loading={logoutMutation.isPending}
                  disabled={logoutMutation.isPending}
                >
                  Đăng xuất
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border-light bg-white shadow-card">
        <button
          type="button"
          onClick={() => toggleSection('privacy')}
          className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
        >
          <h2 className="text-lg font-semibold text-slate-900">Quyền riêng tư</h2>
          <span className="text-xs text-text-secondary sm:text-sm">Ai xem hồ sơ, người dùng đã chặn</span>
        </button>

        {openSection === 'privacy' && (
          <div className="border-t border-border-light px-4 py-4 space-y-5 sm:px-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Ai xem được hồ sơ của bạn</p>
              <select
                value={profileVisibility}
                onChange={(e) => handleChangeVisibility(e.target.value as VisibilityOption)}
                disabled={visibilityMutation.isPending}
                className="h-10 w-full rounded-lg border border-border-main bg-white px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-hover-bg"
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Danh sách người dùng bạn đã chặn</p>

              {blockedUsersLoading ? (
                <p className="text-sm text-text-secondary">Đang tải danh sách...</p>
              ) : blockedUsers.length === 0 ? (
                <p className="text-sm text-text-secondary">Bạn chưa chặn người dùng nào.</p>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((blockedUser) => (
                    <div
                      key={blockedUser.id}
                      className="flex items-center justify-between rounded-xl border border-border-light px-3 py-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={blockedUser.avatar} name={blockedUser.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{blockedUser.displayName}</p>
                          <p className="truncate text-xs text-slate-500">@{blockedUser.username}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => unblockMutation.mutate(blockedUser.id)}
                        loading={unblockMutation.isPending}
                        disabled={unblockMutation.isPending}
                      >
                        Bỏ chặn
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border-light bg-white shadow-card">
        <button
          type="button"
          onClick={() => toggleSection('appearance')}
          className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
        >
          <h2 className="text-lg font-semibold text-slate-900">Giao diện</h2>
          <span className="text-xs text-text-secondary sm:text-sm">Chế độ sáng/tối</span>
        </button>

        {openSection === 'appearance' && (
          <div className="border-t border-border-light px-4 py-4 space-y-3 sm:px-5">
            <p className="text-sm font-medium text-text-primary">Chọn chế độ hiển thị</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={themeMode === 'light' ? 'primary' : 'secondary'}
                onClick={() => setThemeMode('light')}
              >
                Sáng
              </Button>
              <Button
                type="button"
                variant={themeMode === 'dark' ? 'primary' : 'secondary'}
                onClick={() => setThemeMode('dark')}
              >
                Tối
              </Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={() => logoutMutation.mutate(undefined, { onSettled: () => setConfirmLogoutOpen(false) })}
        title="Xác nhận đăng xuất"
        description="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản hiện tại?"
        confirmText="Đăng xuất"
        cancelText="Hủy"
        tone="warning"
        loading={logoutMutation.isPending}
      />
    </div>
  )
}
