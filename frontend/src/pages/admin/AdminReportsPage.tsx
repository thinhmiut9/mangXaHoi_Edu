import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

type ReportStatusFilter = 'ALL' | 'OPEN' | 'RESOLVED' | 'REJECTED'
type ResolveAction = 'MARK_ONLY' | 'HIDE_CONTENT' | 'LOCK_24H' | 'LOCK_7D'
type RejectReason = 'INVALID_REPORT' | 'NO_EVIDENCE' | 'NO_VIOLATION' | 'DUPLICATED'

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
  const normalized = String(type || '').toUpperCase()
  if (normalized === 'POST') return 'Bài viết'
  if (normalized === 'COMMENT') return 'Bình luận'
  if (normalized === 'USER') return 'Người dùng'
  if (normalized === 'GROUP') return 'Nhóm'
  if (normalized === 'DOCUMENT') return 'Tài liệu'
  return normalized || 'Khác'
}

function getReasonLabel(reason?: string) {
  const normalized = String(reason || '').toUpperCase()
  if (normalized === 'SPAM') return 'Spam'
  if (normalized === 'INAPPROPRIATE') return 'Nội dung không phù hợp'
  if (normalized === 'HARASSMENT') return 'Quấy rối'
  if (normalized === 'FAKE_NEWS') return 'Tin giả'
  if (normalized === 'ABUSE') return 'Lạm dụng'
  if (normalized === 'OTHER') return 'Khác'
  return reason || 'Khác'
}

function statusBadge(status?: string) {
  if (status === 'RESOLVED') return { text: 'Đã xử lý', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'REJECTED') return { text: 'Đã bỏ qua', className: 'bg-slate-200 text-slate-700' }
  return { text: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700' }
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('vi-VN')
}

function buildRejectNote(reason: RejectReason, note: string) {
  const labelMap: Record<RejectReason, string> = {
    INVALID_REPORT: 'Báo cáo sai',
    NO_EVIDENCE: 'Thiếu bằng chứng',
    NO_VIOLATION: 'Nội dung không vi phạm',
    DUPLICATED: 'Trùng báo cáo',
  }

  const trimmedNote = note.trim()
  return trimmedNote ? `${labelMap[reason]} - ${trimmedNote}` : labelMap[reason]
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatusFilter>('ALL')
  const [reportDetailModal, setReportDetailModal] = useState<AdminReportRow | null>(null)
  const [resolveModalReport, setResolveModalReport] = useState<AdminReportRow | null>(null)
  const [rejectModalReport, setRejectModalReport] = useState<AdminReportRow | null>(null)
  const [resolveAction, setResolveAction] = useState<ResolveAction>('MARK_ONLY')
  const [resolveNote, setResolveNote] = useState('')
  const [resolveNotifyReporter, setResolveNotifyReporter] = useState(true)
  const [rejectReason, setRejectReason] = useState<RejectReason>('INVALID_REPORT')
  const [rejectNote, setRejectNote] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: reports, isLoading } = useQuery<AdminReportRow[]>({
    queryKey: ['admin-reports-page', status],
    queryFn: () => adminApi.listReports(status === 'ALL' ? undefined : status, 1, 100),
  })

  const reportDetailId = getReportKey(reportDetailModal)
  const { data: reportDetailData, isLoading: reportDetailLoading } = useQuery<AdminReportRow>({
    queryKey: ['admin-report-detail-page', reportDetailId],
    queryFn: () => adminApi.getReportDetail(reportDetailId),
    enabled: !!reportDetailId,
  })

  const updateReportMutation = useMutation({
    mutationFn: (payload: {
      reportId: string
      status: 'RESOLVED' | 'REJECTED'
      action?: ResolveAction
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
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
      queryClient.invalidateQueries({ queryKey: ['admin-reports-page'] })
      queryClient.invalidateQueries({ queryKey: ['admin-report-detail'] })
      queryClient.invalidateQueries({ queryKey: ['admin-report-detail-page'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Đã cập nhật báo cáo')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const currentDetail = reportDetailData ?? reportDetailModal

  const handleResolve = (report: AdminReportRow) => {
    const reportKey = getReportKey(report)
    if (!reportKey) {
      toast.error('Không tìm thấy mã báo cáo để xử lý')
      return
    }

    updateReportMutation.mutate(
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

  const handleReject = (report: AdminReportRow) => {
    const reportKey = getReportKey(report)
    if (!reportKey) {
      toast.error('Không tìm thấy mã báo cáo để bỏ qua')
      return
    }

    updateReportMutation.mutate(
      {
        reportId: reportKey,
        status: 'REJECTED',
        note: buildRejectNote(rejectReason, rejectNote),
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

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý báo cáo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Xem chi tiết nội dung bị báo cáo và thực hiện xử lý moderation trực tiếp.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReportStatusFilter)}
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
        >
          <option value="ALL">Tất cả</option>
          <option value="OPEN">Chờ xử lý</option>
          <option value="RESOLVED">Đã xử lý</option>
          <option value="REJECTED">Đã bỏ qua</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[17%]" />
            <col className="w-[21%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Người báo cáo</th>
              <th className="px-4 py-3 text-left">Đối tượng</th>
              <th className="px-4 py-3 text-left">Nội dung</th>
              <th className="px-4 py-3 text-left">Lý do</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Thời gian</th>
              <th className="px-4 py-3 text-left">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(reports ?? []).map((report) => {
              const reportKey = getReportKey(report)
              const badge = statusBadge(report.status)
              const targetType = getTargetTypeLabel(report.target?.targetType || report.targetType)
              const targetPreview =
                report.target?.content || report.target?.name || report.description || 'Không có mô tả'

              return (
                <tr key={reportKey || `${report.createdAt}-${report.reason}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 align-top">
                    <p className="truncate font-semibold text-slate-800" title={report.reporter?.displayName || 'N/A'}>
                      {report.reporter?.displayName || 'N/A'}
                    </p>
                    <p className="truncate text-xs text-slate-500" title={report.reporter?.email || '-'}>
                      {report.reporter?.email || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-semibold text-slate-700">{targetType}</p>
                    <p
                      className="line-clamp-2 break-all text-xs text-slate-500"
                      title={report.target?.targetId || report.targetId || '-'}
                    >
                      {report.target?.targetId || report.targetId || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="line-clamp-3 leading-6 text-slate-700" title={targetPreview}>
                      {targetPreview}
                    </p>
                    {report.target?.author?.displayName && (
                      <p
                        className="mt-1 truncate text-xs text-slate-500"
                        title={`Tác giả: ${report.target.author.displayName}`}
                      >
                        Tác giả: {report.target.author.displayName}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="line-clamp-2 leading-6 text-slate-700" title={getReasonLabel(report.reason)}>
                      {getReasonLabel(report.reason)}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-500">
                    <span className="block whitespace-nowrap">{formatDateTime(report.createdAt).split(' ')[0]}</span>
                    <span className="block whitespace-nowrap">{formatDateTime(report.createdAt).split(' ')[1] || ''}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-start gap-2">
                      <button
                        className="inline-flex h-9 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                        onClick={() => setReportDetailModal(report)}
                      >
                        Xem
                      </button>
                      <button
                        className="inline-flex h-9 items-center rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setResolveModalReport(report)}
                        disabled={updateReportMutation.isPending || report.status === 'RESOLVED' || report.status === 'REJECTED' || !reportKey}
                      >
                        Xử lý
                      </button>
                      <button
                        className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setRejectModalReport(report)}
                        disabled={updateReportMutation.isPending || report.status === 'RESOLVED' || report.status === 'REJECTED' || !reportKey}
                      >
                        Bỏ qua
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {!isLoading && (reports?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Không có báo cáo phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
          <div className="space-y-3">
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
              <p className="mt-1 font-semibold text-slate-800">{formatDateTime(currentDetail.createdAt)}</p>
              <p className="text-slate-500">Trạng thái: {statusBadge(currentDetail.status).text}</p>
            </div>

            <div className="col-span-2 rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Lý do</p>
              <p className="mt-1 font-semibold text-slate-800">{getReasonLabel(currentDetail.reason)}</p>
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
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Tên đối tượng</p>
                  <p className="mt-1 font-semibold text-slate-800">{currentDetail.target.name}</p>
                </div>
              )}

              {currentDetail.target?.content && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Nội dung bị báo cáo</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{currentDetail.target.content}</p>
                </div>
              )}

              {currentDetail.target?.author && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Người tạo nội dung</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {currentDetail.target.author.displayName || currentDetail.target.author.email || 'N/A'}
                  </p>
                </div>
              )}

              {currentDetail.target?.group?.name && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Thuộc nhóm</p>
                  <p className="mt-1 font-semibold text-slate-800">{currentDetail.target.group.name}</p>
                </div>
              )}

              {!!currentDetail.target?.mediaUrls?.length && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">Media đính kèm</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {currentDetail.target.mediaUrls.slice(0, 3).map((url, idx) => (
                      <img
                        key={`${url}-${idx}`}
                        src={url}
                        alt={`report-media-${idx + 1}`}
                        className="h-20 w-full rounded-md border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              {!currentDetail.target?.content && !currentDetail.target?.name && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Chưa lấy được nội dung chi tiết từ đối tượng bị báo cáo hoặc đối tượng đã bị xóa.
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
              loading={updateReportMutation.isPending}
              onClick={() => {
                if (!resolveModalReport) return
                handleResolve(resolveModalReport)
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
              onChange={(e) => setResolveAction(e.target.value as ResolveAction)}
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
              loading={updateReportMutation.isPending}
              onClick={() => {
                if (!rejectModalReport) return
                handleReject(rejectModalReport)
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
              onChange={(e) => setRejectReason(e.target.value as RejectReason)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="INVALID_REPORT">Báo cáo sai</option>
              <option value="NO_EVIDENCE">Thiếu bằng chứng</option>
              <option value="NO_VIOLATION">Nội dung không vi phạm</option>
              <option value="DUPLICATED">Trùng báo cáo</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Ghi chú admin</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Ghi chú thêm..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
