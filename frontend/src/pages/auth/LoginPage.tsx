import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/Toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { extractError } from '@/api/client'

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được trống'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const toast = useToast()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.token)
      toast.success('Đăng nhập thành công!')
      navigate('/')
    },
    onError: (err) => {
      toast.error(extractError(err))
    },
  })

  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-full mb-4">
            <span className="text-white font-bold text-2xl">E</span>
          </div>
          <h1 className="text-3xl font-bold text-primary-600">EduSocial</h1>
          <p className="text-text-secondary mt-1 text-sm">Mạng xã hội giáo dục</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md border border-border-light p-6">
          <h2 className="text-xl font-bold text-text-primary mb-6 text-center">Đăng nhập</h2>

          <form onSubmit={handleSubmit(data => loginMutation.mutate(data))} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              placeholder="example@email.com"
              error={errors.email?.message}
              fullWidth
              autoComplete="email"
              {...register('email')}
            />
            <Input
              label="Mật khẩu"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              fullWidth
              autoComplete="current-password"
              {...register('password')}
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary-500 hover:underline">
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={loginMutation.isPending || isSubmitting}
              disabled={loginMutation.isPending}
            >
              Đăng nhập
            </Button>
          </form>
        </div>

        {/* Register link */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-border-light p-4 text-center">
          <span className="text-text-secondary text-sm">Chưa có tài khoản? </span>
          <Link to="/register" className="text-primary-500 font-semibold hover:underline text-sm">
            Tạo tài khoản mới
          </Link>
        </div>
      </div>
    </div>
  )
}
