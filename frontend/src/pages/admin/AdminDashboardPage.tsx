import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface DashboardStats {
  totalUsers: number
  totalPosts: number
  totalGroups: number
  totalReports: number
  openReports: number
  newUsersToday: number
  blockedUsers: number
  totalInteractions: number
}

interface AdminUserRow {
  userId: string
  displayName: string
  email: string
  status?: 'ACTIVE' | 'BLOCKED'
  createdAt?: string
}

interface AdminReportRow {
  reportId: string
  id?: string
  reason?: string
  description?: string
  status?: string
  createdAt?: string
  targetId?: string
  targetType?: string
  target?: {
    targetId?: string
    targetType?: string
    content?: string
    name?: string
    avatarUrl?: string
    mediaUrls?: string[]
    visibility?: string
    createdAt?: string
    author?: {
      userId?: string
      displayName?: string
      email?: string
      avatarUrl?: string
    } | null
    group?: {
      groupId?: string
      name?: string
      coverUrl?: string
    } | null
  } | null
  reporter?: {
    userId?: string
    displayName?: string
    email?: string
  }
}

function getReportKey(report?: AdminReportRow | null) {
  if (!report) return ''
  return report.reportId || report.id || ''
}

function getTargetTypeLabel(type?: string) {
  if (!type) return 'Nội dung khác'
  const normalized = String(type).toUpperCase()
  if (normalized === 'POST') return 'Bài viết'
  if (normalized === 'COMMENT') return 'Bình luận'
  if (normalized === 'USER') return 'Người dùng'
  if (normalized === 'GROUP') return 'Nhóm'
  return normalized
}

const numberFmt = new Intl.NumberFormat('vi-VN')

function formatDayLabel(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toDateSafe(value?: string) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function makeRecentLabels(days: number) {
  const labels: string[] = []
  const end = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    labels.push(formatDayLabel(d))
  }
  return labels
}

function makeTicks(maxValue: number) {
  const top = Math.max(1, maxValue)
  const step = Math.max(1, Math.ceil(top / 4))
  return [step * 4, step * 3, step * 2, step, 0]
}

export default function AdminDashboardPage() {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(7)
  const [reportDetailModal, setReportDetailModal] = useState<AdminReportRow | null>(null)
  const [resolveModalReport, setResolveModalReport] = useState<AdminReportRow | null>(null)
  const [rejectModalReport, setRejectModalReport] = useState<AdminReportRow | null>(null)
  const [resolveAction, setResolveAction] = useState<'MARK_ONLY' | 'HIDE_CONTENT' | 'LOCK_24H' | 'LOCK_7D'>('MARK_ONLY')
  const [resolveNote, setResolveNote] = useState('')
  const [resolveNotifyReporter, setResolveNotifyReporter] = useState(true)
  const [rejectReason, setRejectReason] = useState<'INVALID_REPORT' | 'NO_EVIDENCE' | 'NO_VIOLATION' | 'DUPLICATED'>('INVALID_REPORT')
  const [rejectNote, setRejectNote] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['admin-dashboard'],
    queryFn: adminApi.getDashboard,
  })

  const { data: users, isLoading: usersLoading } = useQuery<AdminUserRow[]>({
    queryKey: ['admin-users', rangeDays],
    queryFn: () => adminApi.listUsers(1, undefined, 200),
  })

  const { data: reports, isLoading: reportsLoading } = useQuery<AdminReportRow[]>({
    queryKey: ['admin-reports', rangeDays],
    queryFn: () => adminApi.listReports(undefined, 1, 200),
  })

  const resolveReportMutation = useMutation({
    mutationFn: (payload: {
      reportId: string
      status: 'RESOLVED' | 'REJECTED'
      action?: 'MARK_ONLY' | 'HIDE_CONTENT' | 'LOCK_24H' | 'LOCK_7D'
      note?: string
      notifyReporter?: boolean
    }) =>
      adminApi.updateReport(payload.reportId, {
        status: payload.status,
        action: payload.action,
        note: payload.note,
        notifyReporter: payload.notifyReporter,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
      toast.success('Đã cập nhật trạng thái báo cáo')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const reportDetailId = getReportKey(reportDetailModal)
  const { data: reportDetailData, isLoading: reportDetailLoading } = useQuery<AdminReportRow>({
    queryKey: ['admin-report-detail', reportDetailId],
    queryFn: () => adminApi.getReportDetail(reportDetailId),
    enabled: !!reportDetailId,
  })

  const recentLabels = useMemo(() => makeRecentLabels(rangeDays), [rangeDays])

  const usersByDay = useMemo(() => {
    const counts = new Map<string, number>()
    for (const label of recentLabels) counts.set(label, 0)
    for (const user of users ?? []) {
      const d = toDateSafe(user.createdAt)
      if (!d) continue
      const label = formatDayLabel(d)
      if (counts.has(label)) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return recentLabels.map((label) => counts.get(label) ?? 0)
  }, [users, recentLabels])

  const reportsByDay = useMemo(() => {
    const counts = new Map<string, number>()
    for (const label of recentLabels) counts.set(label, 0)
    for (const report of reports ?? []) {
      const d = toDateSafe(report.createdAt)
      if (!d) continue
      const label = formatDayLabel(d)
      if (counts.has(label)) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return recentLabels.map((label) => counts.get(label) ?? 0)
  }, [reports, recentLabels])

  const openReportsByDay = useMemo(() => {
    let running = 0
    return reportsByDay.map((value) => {
      running += value
      return running
    })
  }, [reportsByDay])

  const recentReports = useMemo(() => (reports ?? []).slice(0, 5), [reports])

  const summaryCards = [
    { title: 'Tổng số người dùng', value: stats?.totalUsers ?? 0, note: `+${stats?.newUsersToday ?? 0} người dùng mới hôm nay`, tone: 'blue' },
    { title: 'Người dùng mới', value: stats?.newUsersToday ?? 0, note: `Trong ${rangeDays} ngày gần nhất`, tone: 'green' },
    { title: 'Tổng số bài viết', value: stats?.totalPosts ?? 0, note: `Tổng số nhóm: ${numberFmt.format(stats?.totalGroups ?? 0)}`, tone: 'indigo' },
    { title: 'Báo cáo vi phạm chờ xử lý', value: stats?.openReports ?? 0, note: 'Cần kiểm duyệt ngay', tone: 'amber' },
    { title: 'Tài khoản đang bị khóa', value: stats?.blockedUsers ?? 0, note: 'Theo trạng thái BLOCKED', tone: 'rose' },
  ] as const

  const usersMax = Math.max(...usersByDay, 1)
  const reportsMax = Math.max(...reportsByDay, 1)
  const usersTicks = makeTicks(usersMax)
  const reportsTicks = makeTicks(reportsMax)

  const isLoading = statsLoading || usersLoading || reportsLoading

  const toneClass = (tone: string) => {
    if (tone === 'blue') return 'from-blue-50 to-blue-100/70 text-blue-700 border-blue-200'
    if (tone === 'green') return 'from-emerald-50 to-emerald-100/70 text-emerald-700 border-emerald-200'
    if (tone === 'indigo') return 'from-indigo-50 to-indigo-100/70 text-indigo-700 border-indigo-200'
    if (tone === 'amber') return 'from-amber-50 to-amber-100/70 text-amber-700 border-amber-200'
    if (tone === 'rose') return 'from-rose-50 to-rose-100/70 text-rose-700 border-rose-200'
    return 'from-violet-50 to-violet-100/70 text-violet-700 border-violet-200'
  }

  const statusBadge = (status?: string) => {
    if (status === 'RESOLVED') return { text: 'Đã xử lý', className: 'bg-emerald-100 text-emerald-700' }
    if (status === 'REJECTED') return { text: 'Đã bỏ qua', className: 'bg-slate-200 text-slate-700' }
    return { text: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700' }
  }

  const resolveReport = (report: AdminReportRow) => {
    const reportKey = getReportKey(report)
    if (!reportKey) {
      toast.error('Không tìm thấy mã báo cáo để xử lý')
      return
    }
    resolveReportMutation.mutate(
      {
        reportId: reportKey,
        status: 'RESOLVED',
        action: resolveAction,
        note: resolveNote.trim() || undefined,
        notifyReporter: resolveNotifyReporter,
      },
      {
        onSuccess: () => {
          setResolveModalReport(null)
          setResolveAction('MARK_ONLY')
          setResolveNote('')
          setResolveNotifyReporter(true)
        },
      }
    )
  }

  const rejectReport = (report: AdminReportRow) => {
    const reportKey = getReportKey(report)
    if (!reportKey) {
      toast.error('Không tìm thấy mã báo cáo để bỏ qua')
      return
    }
    resolveReportMutation.mutate(
      {
        reportId: reportKey,
        status: 'REJECTED',
        note: rejectNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setRejectModalReport(null)
          setRejectReason('INVALID_REPORT')
          setRejectNote('')
        },
      }
    )
  }

  const currentDetail = reportDetailData ?? reportDetailModal

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-slate-800">Tổng quan hệ thống</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Theo dõi người dùng, nội dung, báo cáo và thống kê hoạt động hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value) as 7 | 14 | 30)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            <option value={7}>7 ngày qua</option>
            <option value={14}>14 ngày qua</option>
            <option value={30}>30 ngày qua</option>
          </select>
          <button
            className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-200"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
              queryClient.invalidateQueries({ queryKey: ['admin-users'] })
              queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
              toast.success('Đã làm mới dữ liệu')
            }}
          >
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {summaryCards.map((card) => (
          <button
            key={card.title}
            onClick={() => {
              if (card.title.includes('báo cáo')) navigate('/admin/reports')
              if (card.title.includes('người dùng') || card.title.includes('Tài khoản')) navigate('/admin/users')
            }}
            className={`rounded-2xl border bg-gradient-to-br p-3.5 text-left shadow-sm ${toneClass(card.tone)}`}
          >
            <p className="text-xs font-semibold">{card.title}</p>
            <p className="mt-1.5 text-[30px] font-bold tracking-tight text-slate-800">{numberFmt.format(card.value)}</p>
            <p className="mt-1 text-[11px] font-medium">{card.note}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-slate-800">Người dùng đăng ký mới theo thời gian</h3>
            <span className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500 inline-flex items-center">Theo ngày</span>
          </div>
          <div className="relative h-[270px] rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="absolute inset-x-3 top-3 bottom-9 flex flex-col justify-between pointer-events-none">
              {usersTicks.map((tick) => (
                <div key={`ut-${tick}`} className="relative border-t border-slate-200/80">
                  <span className="absolute -left-0 -top-2.5 bg-slate-50 px-1 text-[10px] text-slate-400">{tick}</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-8 top-4 bottom-11 flex items-end gap-2">
              {usersByDay.map((value, i) => {
                const h = `${(value / usersMax) * 100}%`
                return (
                  <div key={`u-bar-${recentLabels[i]}`} className="h-full flex-1 min-w-0 flex flex-col items-center justify-end">
                    <span className="mb-1 text-[10px] font-semibold text-blue-700">{value}</span>
                    <div className="w-full max-w-[30px] rounded-t-md bg-blue-600/90" style={{ height: h || '2%' }} />
                  </div>
                )
              })}
            </div>
            <div className={`absolute inset-x-3 bottom-2 grid text-center text-[11px] font-medium text-slate-400`} style={{ gridTemplateColumns: `repeat(${recentLabels.length}, minmax(0, 1fr))` }}>
              {recentLabels.map((label) => <span key={`ul-${label}`}>{label}</span>)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-slate-800">Báo cáo phát sinh theo thời gian</h3>
            <span className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500 inline-flex items-center">Theo ngày</span>
          </div>
          <div className="relative h-[270px] rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="absolute inset-x-3 top-3 bottom-9 flex flex-col justify-between pointer-events-none">
              {reportsTicks.map((tick) => (
                <div key={`rt-${tick}`} className="relative border-t border-slate-200/80">
                  <span className="absolute -left-0 -top-2.5 bg-slate-50 px-1 text-[10px] text-slate-400">{tick}</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-8 top-4 bottom-11 flex items-end gap-2">
              {reportsByDay.map((value, i) => {
                const h = `${(value / reportsMax) * 100}%`
                return (
                  <div key={`r-bar-${recentLabels[i]}`} className="h-full flex-1 min-w-0 flex flex-col items-center justify-end">
                    <span className="mb-1 text-[10px] font-semibold text-rose-700">{value}</span>
                    <div className="w-full max-w-[30px] rounded-t-md bg-rose-500/90" style={{ height: h || '2%' }} />
                  </div>
                )
              })}
            </div>
            <div className={`absolute inset-x-3 bottom-2 grid text-center text-[11px] font-medium text-slate-400`} style={{ gridTemplateColumns: `repeat(${recentLabels.length}, minmax(0, 1fr))` }}>
              {recentLabels.map((label) => <span key={`rl-${label}`}>{label}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
            <h3 className="text-[15px] font-bold text-slate-800">Nội dung bị báo cáo gần đây</h3>
            <button className="text-xs font-semibold text-blue-600" onClick={() => navigate('/admin/reports')}>Xem tất cả báo cáo →</button>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="min-w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2">Nội dung</th><th className="pb-2">Người báo cáo</th><th className="pb-2">Lý do</th><th className="pb-2">Thời gian</th><th className="pb-2">Trạng thái</th><th className="pb-2">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {recentReports.map((row) => (
                  <tr key={getReportKey(row) || `${row.createdAt}-${row.reason}`} className="border-t border-slate-100">
                    <td className="py-2.5 max-w-[220px] truncate">{row.description || row.reason || 'Báo cáo không có mô tả'}</td>
                    <td>{row.reporter?.displayName || row.reporter?.email || 'N/A'}</td>
                    <td>{row.reason || 'Khác'}</td>
                    <td>{toDateSafe(row.createdAt)?.toLocaleString('vi-VN') ?? '-'}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${statusBadge(row.status).className}`}>
                        {statusBadge(row.status).text}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="inline-flex h-8 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 hover:text-blue-800"
                        onClick={() => setReportDetailModal(row)}
                      >
                        Xem
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => setResolveModalReport(row)}
                        disabled={resolveReportMutation.isPending || row.status === 'RESOLVED' || row.status === 'REJECTED' || !getReportKey(row)}
                      >
                        Xử lý
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => setRejectModalReport(row)}
                        disabled={resolveReportMutation.isPending || row.status === 'RESOLVED' || row.status === 'REJECTED' || !getReportKey(row)}
                      >
                        Bỏ qua
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!recentReports.length && !isLoading && (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-400">Chưa có báo cáo nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <h3 className="text-[15px] font-bold text-slate-800">Truy cập nhanh</h3>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <button className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/70 p-3.5 text-left shadow-sm transition hover:-translate-y-0.5" onClick={() => navigate('/admin/users')}>
            <p className="text-sm font-bold text-blue-700">Quản lý người dùng</p>
            <p className="mt-1 text-xs font-medium text-blue-700/80">Xem, khóa/mở khóa tài khoản người dùng</p>
          </button>
          <button className="rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/70 p-3.5 text-left shadow-sm transition hover:-translate-y-0.5" onClick={() => navigate('/admin/reports')}>
            <p className="text-sm font-bold text-emerald-700">Kiểm duyệt nội dung</p>
            <p className="mt-1 text-xs font-medium text-emerald-700/80">Xem, duyệt và xử lý nội dung vi phạm</p>
          </button>
          <button className="rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100/70 p-3.5 text-left shadow-sm transition hover:-translate-y-0.5" onClick={() => navigate('/admin/reports')}>
            <p className="text-sm font-bold text-amber-700">Xem báo cáo vi phạm</p>
            <p className="mt-1 text-xs font-medium text-amber-700/80">Danh sách nội dung bị người dùng báo cáo</p>
          </button>
          <button className="rounded-xl border bg-gradient-to-br from-violet-50 to-violet-100/70 p-3.5 text-left shadow-sm transition hover:-translate-y-0.5" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <p className="text-sm font-bold text-violet-700">Xem thống kê chi tiết</p>
            <p className="mt-1 text-xs font-medium text-violet-700/80">Xem nhanh các chỉ số và biểu đồ hệ thống</p>
          </button>
        </div>
      </section>

      <Modal
        open={!!reportDetailModal}
        onClose={() => setReportDetailModal(null)}
        title={`Chi tiết báo cáo #${getReportKey(currentDetail).slice(0, 8)}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportDetailModal(null)}>Đóng</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!currentDetail) return
                setReportDetailModal(null)
                setResolveModalReport(currentDetail)
              }}
              disabled={currentDetail?.status === 'RESOLVED' || currentDetail?.status === 'REJECTED'}
            >
              Xử lý
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!currentDetail) return
                setReportDetailModal(null)
                setRejectModalReport(currentDetail)
              }}
              disabled={currentDetail?.status === 'RESOLVED' || currentDetail?.status === 'REJECTED'}
            >
              Bỏ qua
            </Button>
          </>
        }
      >
        {reportDetailLoading && (
          <div className="space-y-2">
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          </div>
        )}
        {!reportDetailLoading && currentDetail && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Người báo cáo</p>
              <p className="mt-1 font-semibold text-slate-800">{currentDetail.reporter?.displayName || 'N/A'}</p>
              <p className="text-slate-500">{currentDetail.reporter?.email || '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Thời gian gửi</p>
              <p className="mt-1 font-semibold text-slate-800">{toDateSafe(currentDetail.createdAt)?.toLocaleString('vi-VN') ?? '-'}</p>
              <p className="text-slate-500">Trạng thái: {statusBadge(currentDetail.status).text}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Lý do</p>
              <p className="mt-1 font-semibold text-slate-800">{currentDetail.reason || 'Khác'}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Mô tả</p>
              <p className="mt-1 text-slate-700">{currentDetail.description || 'Không có mô tả chi tiết.'}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
              <p className="text-xs font-semibold text-slate-500">Đối tượng bị báo cáo</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-slate-500">Loại</p>
                  <p className="font-semibold text-slate-800">
                    {getTargetTypeLabel(currentDetail.target?.targetType || currentDetail.targetType)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Mã đối tượng</p>
                  <p className="font-semibold text-slate-800 break-all">
                    {currentDetail.target?.targetId || currentDetail.targetId || 'Không xác định'}
                  </p>
                </div>
              </div>

              {currentDetail.target?.name && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-[11px] text-slate-500">Tên đối tượng</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{currentDetail.target.name}</p>
                </div>
              )}

              {currentDetail.target?.content && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-[11px] text-slate-500">Nội dung bị báo cáo</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-800">{currentDetail.target.content}</p>
                </div>
              )}

              {currentDetail.target?.author && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-[11px] text-slate-500">Người tạo nội dung</p>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {currentDetail.target.author.displayName || currentDetail.target.author.email || 'N/A'}
                  </p>
                </div>
              )}

              {currentDetail.target?.group?.name && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-[11px] text-slate-500">Thuộc nhóm</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{currentDetail.target.group.name}</p>
                </div>
              )}

              {!!currentDetail.target?.mediaUrls?.length && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-[11px] text-slate-500">Ảnh/Media đính kèm</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {currentDetail.target.mediaUrls.slice(0, 3).map((url, idx) => (
                      <img
                        key={`${url}-${idx}`}
                        src={url}
                        alt={`report-target-media-${idx + 1}`}
                        className="h-20 w-full rounded-md border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              {!currentDetail.target?.content && !currentDetail.target?.name && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Chưa lấy được nội dung chi tiết từ đối tượng bị báo cáo (dữ liệu cũ hoặc đối tượng đã bị xóa).
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!resolveModalReport}
        onClose={() => setResolveModalReport(null)}
        title="Xử lý báo cáo"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolveModalReport(null)}>Hủy</Button>
            <Button
              variant="danger"
              loading={resolveReportMutation.isPending}
              onClick={() => {
                if (!resolveModalReport) return
                resolveReport(resolveModalReport)
              }}
            >
              Xác nhận xử lý
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-rose-700">
            Báo cáo sẽ được chuyển sang trạng thái <span className="font-semibold">Đã xử lý</span>.
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Hành động moderation</label>
            <select
              value={resolveAction}
              onChange={(e) => setResolveAction(e.target.value as typeof resolveAction)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="MARK_ONLY">Chỉ đánh dấu đã xử lý</option>
              <option value="HIDE_CONTENT">Xóa nội dung vi phạm</option>
              <option value="LOCK_24H">Khóa tài khoản 24 giờ</option>
              <option value="LOCK_7D">Khóa tài khoản 7 ngày</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Ghi chú admin</label>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
              placeholder="Nhập lý do xử lý..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={resolveNotifyReporter}
              onChange={(e) => setResolveNotifyReporter(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Gửi thông báo cho người báo cáo
          </label>
        </div>
      </Modal>

      <Modal
        open={!!rejectModalReport}
        onClose={() => setRejectModalReport(null)}
        title="Bỏ qua báo cáo"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModalReport(null)}>Hủy</Button>
            <Button
              variant="outline"
              loading={resolveReportMutation.isPending}
              onClick={() => {
                if (!rejectModalReport) return
                rejectReport(rejectModalReport)
              }}
            >
              Xác nhận bỏ qua
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Lý do bỏ qua</label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value as typeof rejectReason)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="INVALID_REPORT">Báo cáo sai</option>
              <option value="NO_EVIDENCE">Thiếu bằng chứng</option>
              <option value="NO_VIOLATION">Nội dung không vi phạm</option>
              <option value="DUPLICATED">Trùng báo cáo</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Ghi chú admin (không bắt buộc)</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Ghi chú thêm..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            Gửi phản hồi cho người báo cáo
          </label>
        </div>
      </Modal>
    </div>
  )
}
