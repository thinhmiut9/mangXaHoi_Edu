import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { authApi } from '@/api/auth'
import { useToast } from '@/components/ui/Toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { extractError } from '@/api/client'

const schema = z
  .object({
    displayName: z.string().min(2, 'Tên tối thiểu 2 ký tự').max(50),
    email: z.string().email('Email không hợp lệ'),
    password: z
      .string()
      .min(8, 'Tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Phải có ít nhất 1 chữ số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu không khớp',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

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

export default function RegisterPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  const mutation = useMutation({
    mutationFn: (data: Omit<FormValues, 'confirmPassword'>) => authApi.register(data),
    onSuccess: () => {
      toast.success('Đăng ký thành công! Chào mừng đến EduSocial 🎉')
      navigate('/login')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const onSubmit = (data: FormValues) => {
    const { confirmPassword, ...rest } = data
    mutation.mutate(rest)
  }

  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-500 rounded-full mb-3">
            <span className="text-white font-bold text-xl">E</span>
          </div>
          <h1 className="text-2xl font-bold text-primary-600">EduSocial</h1>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-border-light p-6">
          <h2 className="text-xl font-bold text-center mb-6">Tạo tài khoản mới</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Họ và tên"
              placeholder="Nguyễn Văn A"
              error={errors.displayName?.message}
              fullWidth
              {...register('displayName')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="example@email.com"
              error={errors.email?.message}
              fullWidth
              {...register('email')}
            />
            <Input
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              error={errors.password?.message}
              fullWidth
              hint="Tối thiểu 8 ký tự, có chữ hoa và chữ số"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="text-text-muted hover:text-text-primary focus:outline-none"
                >
                  <PasswordToggleIcon show={showPassword} />
                </button>
              }
              {...register('password')}
            />
            <Input
              label="Xác nhận mật khẩu"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              fullWidth
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="text-text-muted hover:text-text-primary focus:outline-none"
                >
                  <PasswordToggleIcon show={showConfirmPassword} />
                </button>
              }
              {...register('confirmPassword')}
            />

            <Button type="submit" fullWidth loading={mutation.isPending} disabled={mutation.isPending}>
              Đăng ký
            </Button>
          </form>
        </div>

        <div className="mt-4 bg-white rounded-xl shadow-sm border border-border-light p-4 text-center">
          <span className="text-text-secondary text-sm">Đã có tài khoản? </span>
          <Link to="/login" className="text-primary-500 font-semibold hover:underline text-sm">
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  )
}
