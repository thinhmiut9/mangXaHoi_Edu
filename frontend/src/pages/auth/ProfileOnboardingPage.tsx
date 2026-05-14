import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/Toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { extractError } from '@/api/client'
import { hasRequiredRecommendationProfile } from '@/utils/profileCompletion'

const schema = z.object({
  major: z.string().trim().min(1, 'Vui lòng nhập ngành học').max(120, 'Ngành học không được vượt quá 120 ký tự'),
  location: z.string().trim().min(1, 'Vui lòng nhập quê quán').max(120, 'Quê quán không được vượt quá 120 ký tự'),
  school: z.string().trim().min(1, 'Vui lòng nhập trường học').max(120, 'Trường học không được vượt quá 120 ký tự'),
})

type FormValues = z.infer<typeof schema>

export default function ProfileOnboardingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, updateUser, clearAuth } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      major: user?.major ?? '',
      location: user?.location ?? '',
      school: user?.school ?? '',
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: FormValues) => usersApi.updateProfile({
      major: data.major.trim(),
      location: data.location.trim(),
      school: data.school.trim(),
    }),
    onSuccess: (updatedUser) => {
      updateUser({
        major: updatedUser.major,
        location: updatedUser.location,
        school: updatedUser.school,
      })
      toast.success('Đã lưu hồ sơ cơ bản')
      navigate('/', { replace: true })
    },
    onError: (err) => {
      toast.error(extractError(err))
    },
  })

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (hasRequiredRecommendationProfile(user)) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_34%),linear-gradient(180deg,#f4fbf7_0%,#ffffff_55%,#eef8ff_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative overflow-hidden bg-[linear-gradient(145deg,#0f766e_0%,#16a34a_55%,#84cc16_100%)] p-8 text-white sm:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.26),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.18),_transparent_30%)]" />
            <div className="relative space-y-6">
              <span className="inline-flex rounded-full bg-white/14 px-4 py-1 text-sm font-semibold tracking-[0.18em] text-white/92 uppercase">
                Thiết lập hồ sơ
              </span>

              <div className="space-y-4">
                <h1 className="max-w-lg text-[2.15rem] font-black leading-[1.06] tracking-[-0.03em] sm:text-[3rem]">
                  Thêm thông tin để nhận gợi ý kết bạn phù hợp hơn
                </h1>
                <p className="max-w-xl text-[15px] leading-7 text-emerald-50/92 sm:text-[17px]">
                  Điền quê quán, ngành học và trường học để chúng tôi gợi ý những người có hồ sơ gần với bạn.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/90">Gợi ý sớm hơn</p>
                  <p className="mt-2 text-sm leading-6 text-white/88">
                    Tài khoản mới vẫn có thể nhận gợi ý ngay cả khi chưa có bạn bè.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/16 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/90">Hồ sơ rõ hơn</p>
                  <p className="mt-2 text-sm leading-6 text-white/88">
                    Quê quán, ngành học và trường học giúp kết quả gợi ý sát hơn.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="p-8 sm:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-900">Hoàn thiện hồ sơ cơ bản</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Thêm 3 thông tin bên dưới để tiếp tục vào hệ thống.
                </p>
              </div>

              <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-5" noValidate>
                <Input
                  label="Ngành học"
                  placeholder="Ví dụ: Công nghệ thông tin"
                  fullWidth
                  error={errors.major?.message}
                  {...register('major')}
                />

                <Input
                  label="Quê quán"
                  placeholder="Ví dụ: Quảng Ngãi"
                  fullWidth
                  error={errors.location?.message}
                  {...register('location')}
                />

                <Input
                  label="Trường học"
                  placeholder="Ví dụ: Đại học Bách khoa"
                  fullWidth
                  error={errors.school?.message}
                  hint="Ba thông tin này sẽ được dùng để tạo gợi ý kết bạn phù hợp hơn cho tài khoản mới."
                  {...register('school')}
                />

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={saveMutation.isPending || isSubmitting}
                  disabled={saveMutation.isPending}
                >
                  Tiếp tục
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    clearAuth()
                    navigate('/login', { replace: true })
                  }}
                  className="w-full text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  Đăng xuất
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
