import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useToast } from '@/components/ui/Toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { extractError } from '@/api/client'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword(token, password),
    onSuccess: () => {
      toast.success('Đặt lại mật khẩu thành công!')
      navigate('/login')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Mật khẩu tối thiểu 8 ký tự'); return }
    if (password !== confirm) { setError('Mật khẩu không khớp'); return }
    setError('')
    mutation.mutate()
  }

  if (!token) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md text-center">
        <p className="text-error-500 mb-4">Liên kết không hợp lệ</p>
        <Link to="/forgot-password" className="text-primary-500 hover:underline">Yêu cầu liên kết mới</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-md border border-border-light p-6">
          <h2 className="text-xl font-bold mb-2">Đặt lại mật khẩu</h2>
          <p className="text-sm text-text-secondary mb-6">Nhập mật khẩu mới cho tài khoản của bạn</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Mật khẩu mới" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" hint="Tối thiểu 8 ký tự, có chữ hoa và số" fullWidth />
            <Input label="Xác nhận mật khẩu" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" error={error} fullWidth />
            <Button type="submit" fullWidth loading={mutation.isPending}>Đặt lại mật khẩu</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
