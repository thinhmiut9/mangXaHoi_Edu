import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
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

function PasswordToggleIcon({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg width='18' height='18' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path d='M3 3l18 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        <path d='M10.58 10.58a2 2 0 002.83 2.83' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        <path d='M9.88 5.09A10.94 10.94 0 0112 4c5 0 9.27 3.11 11 8a11.77 11.77 0 01-4.18 5.94' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        <path d='M6.61 6.61A12.2 12.2 0 001 12c1.73 4.89 6 8 11 8a10.94 10.94 0 005.09-1.17' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
      </svg>
    )
  }

  return (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
      <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z' stroke='currentColor' strokeWidth='2' />
      <circle cx='12' cy='12' r='3' stroke='currentColor' strokeWidth='2' />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const toast = useToast()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
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
    <div className='relative min-h-screen overflow-hidden bg-app-bg px-4 py-12'>
      <div className='pointer-events-none absolute -left-16 top-16 h-56 w-56 rounded-full bg-gradient-to-br from-primary-400/35 to-cyan-300/25 blur-3xl animate-[floatBlob_14s_ease-in-out_infinite]' />
      <div className='pointer-events-none absolute right-[-70px] top-[22%] h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-400/20 blur-3xl animate-[floatBlob_18s_ease-in-out_infinite_reverse]' />
      <div className='pointer-events-none absolute bottom-20 left-[36%] h-52 w-52 rounded-full bg-gradient-to-br from-sky-400/25 to-primary-500/18 blur-3xl animate-[floatBlob_16s_ease-in-out_infinite]' />

      <div className='relative z-10 mx-auto flex w-full max-w-sm flex-col justify-center'>
        <div className='mb-8 text-center'>
          <div className='mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-blue-600 shadow-[0_10px_24px_rgba(24,119,242,0.4)]'>
            <span className='text-2xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]'>E</span>
          </div>
          <h1 className='bg-gradient-to-r from-primary-500 to-blue-600 bg-clip-text text-3xl font-bold text-transparent'>EduSocial</h1>
          <p className='mt-1 text-sm text-text-secondary'>Mạng xã hội giáo dục</p>
        </div>

        <div className='rounded-3xl border border-border-light bg-white/88 p-6 shadow-2xl backdrop-blur-sm'>
          <h2 className='mb-6 text-center text-xl font-bold text-text-primary'>Đăng nhập</h2>

          <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))} className='space-y-5' noValidate>
            <Input
              label='Email'
              type='email'
              placeholder='example@email.com'
              error={errors.email?.message}
              fullWidth
              autoComplete='email'
              {...register('email')}
            />
            <Input
              label='Mật khẩu'
              type={showPassword ? 'text' : 'password'}
              placeholder='••••••••'
              error={errors.password?.message}
              fullWidth
              autoComplete='current-password'
              rightIcon={
                <button
                  type='button'
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className='text-text-muted hover:text-text-primary focus:outline-none'
                >
                  <PasswordToggleIcon show={showPassword} />
                </button>
              }
              {...register('password')}
            />

            <div className='flex justify-end'>
              <Link to='/forgot-password' className='text-sm text-primary-500 hover:underline'>
                Quên mật khẩu?
              </Link>
            </div>

            <Button type='submit' fullWidth loading={loginMutation.isPending || isSubmitting} disabled={loginMutation.isPending}>
              Đăng nhập
            </Button>
          </form>
        </div>

        <div className='mt-4 rounded-xl border border-border-light bg-white p-4 text-center shadow-sm'>
          <span className='text-sm text-text-secondary'>Chưa có tài khoản? </span>
          <Link to='/register' className='text-sm font-semibold text-primary-500 hover:underline'>
            Tạo tài khoản mới
          </Link>
        </div>
      </div>

      <div className='pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden'>
        <div className='absolute inset-x-[-8%] bottom-[-28px] h-36 bg-gradient-to-t from-primary-200/30 to-transparent blur-2xl' />
        <svg
          className='relative h-[140px] w-[130%] -translate-x-[8%] animate-[waveDrift_10s_ease-in-out_infinite]'
          viewBox='0 0 1440 320'
          preserveAspectRatio='none'
        >
          <path fill='rgba(24,119,242,0.20)' d='M0,256L60,240C120,224,240,192,360,176C480,160,600,160,720,181.3C840,203,960,245,1080,245.3C1200,245,1320,203,1380,181.3L1440,160L1440,320L0,320Z' />
        </svg>
      </div>
    </div>
  )
}
