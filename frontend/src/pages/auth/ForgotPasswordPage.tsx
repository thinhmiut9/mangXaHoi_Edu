import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useToast } from '@/components/ui/Toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { extractError } from '@/api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => setSent(true),
    onError: (err) => toast.error(extractError(err)),
  })

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-600">EduSocial</h1>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-border-light p-6">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">📧</div>
              <h2 className="text-xl font-bold mb-2">Kiểm tra email của bạn</h2>
              <p className="text-sm text-text-secondary">
                Nếu email <strong>{email}</strong> tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu.
              </p>
              <Link to="/login" className="mt-6 inline-block text-primary-500 hover:underline text-sm font-medium">
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2">Quên mật khẩu?</h2>
              <p className="text-sm text-text-secondary mb-6">Nhập email để nhận liên kết đặt lại mật khẩu</p>
              <div className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  fullWidth
                />
                <Button fullWidth loading={mutation.isPending} onClick={() => mutation.mutate()}>
                  Gửi liên kết
                </Button>
                <Link to="/login" className="block text-center text-sm text-text-secondary hover:text-primary-500">
                  ← Quay lại đăng nhập
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
