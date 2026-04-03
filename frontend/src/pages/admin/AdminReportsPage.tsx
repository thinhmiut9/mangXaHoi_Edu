import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { useToast } from '@/components/ui/Toast'
import { extractError } from '@/api/client'

interface AdminReportRow {
  reportId: string
  id?: string
  reason?: string
  description?: string
  status?: string
  createdAt?: string
  reporter?: {
    displayName?: string
    email?: string
  }
}

function getReportKey(report: AdminReportRow) {
  return report.reportId || report.id || ''
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL')
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: reports, isLoading } = useQuery<AdminReportRow[]>({
    queryKey: ['admin-reports-page', status],
    queryFn: () => adminApi.listReports(status === 'ALL' ? undefined : status, 1, 100),
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateReport(id, { status: 'RESOLVED', action: 'MARK_ONLY' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
      queryClient.invalidateQueries({ queryKey: ['admin-reports-page'] })
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Đã xử lý báo cáo')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Quản lý báo cáo</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'ALL' | 'OPEN' | 'RESOLVED')}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="ALL">Tất cả</option>
          <option value="OPEN">Chờ xử lý</option>
          <option value="RESOLVED">Đã xử lý</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Người báo cáo</th>
              <th className="px-4 py-3 text-left">Nội dung</th>
              <th className="px-4 py-3 text-left">Lý do</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Thời gian</th>
              <th className="px-4 py-3 text-left">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(reports ?? []).map((r) => (
              <tr key={getReportKey(r) || `${r.createdAt}-${r.reason}`} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-700">{r.reporter?.displayName || 'N/A'}</p>
                  <p className="text-xs text-slate-500">{r.reporter?.email || '-'}</p>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-[360px] truncate">{r.description || r.reason || 'Không có mô tả'}</td>
                <td className="px-4 py-3 text-slate-600">{r.reason || 'Khác'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.status === 'RESOLVED' ? 'Đã xử lý' : 'Chờ xử lý'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '-'}</td>
                <td className="px-4 py-3">
                  <button
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-blue-300"
                    onClick={() => {
                      const reportKey = getReportKey(r)
                      if (!reportKey) {
                        toast.error('Không tìm thấy mã báo cáo để xử lý')
                        return
                      }
                      resolveMutation.mutate(reportKey)
                    }}
                    disabled={resolveMutation.isPending || r.status === 'RESOLVED' || !getReportKey(r)}
                  >
                    Đánh dấu đã xử lý
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && (reports?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Không có báo cáo phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
