import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api'
import { extractError } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

type DocumentStatus = 'PENDING' | 'ACTIVE' | 'REJECTED'
type DocumentFilter = 'ALL' | DocumentStatus

interface AdminDocumentRow {
  documentId: string
  title: string
  fileName: string
  fileUrl: string
  fileHash?: string
  uploadSourceName?: string
  duplicateOf?: string
  fileType: 'PDF' | 'DOC' | 'PPT'
  subject?: string
  school?: string
  major?: string
  cohort?: string
  description?: string
  tags?: string[]
  visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  status?: DocumentStatus
  uploaderId?: string
  uploaderName?: string
  uploaderAvatar?: string
  createdAt?: string
  reviewedAt?: string
  reviewedBy?: string
  moderationNote?: string
}

function repairMojibake(value?: string) {
  if (!value) return ''
  if (!/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß]/.test(value)) return value

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff)
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    return decoded.includes('�') ? value : decoded
  } catch {
    return value
  }
}

function statusBadge(status?: string) {
  if (status === 'ACTIVE') return { text: 'Đã duyệt', className: 'bg-emerald-100 text-emerald-700' }
  if (status === 'REJECTED') return { text: 'Từ chối', className: 'bg-rose-100 text-rose-700' }
  return { text: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700' }
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('vi-VN')
}

export default function AdminDocumentsPage() {
  const [status, setStatus] = useState<DocumentFilter>('PENDING')
  const [detailModal, setDetailModal] = useState<AdminDocumentRow | null>(null)
  const [note, setNote] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: documents, isLoading } = useQuery<AdminDocumentRow[]>({
    queryKey: ['admin-documents', status],
    queryFn: () => adminApi.listDocuments(status, 1, 100),
  })

  const reviewMutation = useMutation({
    mutationFn: (payload: { id: string; status: 'ACTIVE' | 'REJECTED'; moderationNote?: string }) =>
      adminApi.reviewDocument(payload.id, {
        status: payload.status,
        moderationNote: payload.moderationNote,
      }),
    onSuccess: async () => {
      setDetailModal(null)
      setNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-documents'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-library'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-mine'] }),
      ])
      toast.success('Đã cập nhật trạng thái tài liệu')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => adminApi.deleteDocument(documentId),
    onSuccess: async () => {
      setDetailModal(null)
      setNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-documents'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-library'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-mine'] }),
      ])
      toast.success('Đã xóa tài liệu')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const currentDetailId = detailModal?.documentId || ''
  const { data: detailData, isLoading: detailLoading } = useQuery<AdminDocumentRow>({
    queryKey: ['admin-document-detail', currentDetailId],
    queryFn: () => adminApi.getDocumentDetail(currentDetailId),
    enabled: !!currentDetailId,
  })

  const currentDetail = useMemo(() => detailData ?? detailModal, [detailData, detailModal])
  const displayFileName = repairMojibake(currentDetail?.fileName)

  const handleOpenFile = async (download = false) => {
    if (!currentDetail?.documentId) return
    try {
      const url = await adminApi.getDocumentAccessUrl(currentDetail.documentId, download)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kiểm duyệt tài liệu</h1>
          <p className="mt-1 text-sm text-slate-500">Tài liệu mới được đưa vào hàng chờ duyệt trước khi hiển thị công khai.</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DocumentFilter)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="PENDING">Chờ duyệt</option>
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đã duyệt</option>
          <option value="REJECTED">Đã từ chối</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Tiêu đề</th>
              <th className="px-4 py-3 text-left">Người đăng</th>
              <th className="px-4 py-3 text-left">Loại</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Thời gian</th>
              <th className="px-4 py-3 text-left">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(documents ?? []).map((doc) => (
              <tr key={doc.documentId} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-700">{doc.title || doc.fileName}</p>
                  <p className="text-xs text-slate-500">{doc.subject || doc.major || 'Chưa cập nhật môn/ngành'}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{doc.uploaderName || doc.uploaderId || 'N/A'}</td>
                <td className="px-4 py-3 text-slate-600">{doc.fileType}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(doc.status).className}`}>
                    {statusBadge(doc.status).text}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(doc.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    <button
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => {
                        setNote(doc.moderationNote || '')
                        setDetailModal(doc)
                      }}
                    >
                      Xem chi tiết
                    </button>
                    <button
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
                      onClick={() => {
                        if (!window.confirm(`Xóa "${doc.title || doc.fileName}"?`)) return
                        deleteMutation.mutate(doc.documentId)
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Xóa tài liệu
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && (documents?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Không có tài liệu phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!detailModal}
        onClose={() => {
          setDetailModal(null)
          setNote('')
        }}
        title="Chi tiết tài liệu"
        size="xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setDetailModal(null)
                setNote('')
              }}
            >
              Đóng
            </Button>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                loading={reviewMutation.isPending}
                onClick={() => {
                  if (!currentDetail?.documentId) return
                  reviewMutation.mutate({
                    id: currentDetail.documentId,
                    status: 'REJECTED',
                    moderationNote: note.trim() || undefined,
                  })
                }}
                disabled={currentDetail?.status === 'REJECTED'}
              >
                Từ chối
              </Button>
              <Button
                loading={reviewMutation.isPending}
                onClick={() => {
                  if (!currentDetail?.documentId) return
                  reviewMutation.mutate({
                    id: currentDetail.documentId,
                    status: 'ACTIVE',
                    moderationNote: note.trim() || undefined,
                  })
                }}
                disabled={currentDetail?.status === 'ACTIVE'}
              >
                Phê duyệt
              </Button>
            </div>
          </div>
        }
      >
        {detailLoading && <div className="py-8 text-sm text-slate-500">Đang tải chi tiết...</div>}
        {!detailLoading && currentDetail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold text-slate-500">Tiêu đề</p>
                <p className="mt-1 text-lg font-semibold leading-snug text-slate-800">{currentDetail.title || currentDetail.fileName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold text-slate-500">Trạng thái</p>
                <div className="mt-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusBadge(currentDetail.status).className}`}>
                    {statusBadge(currentDetail.status).text}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold text-slate-500">Người đăng</p>
                <p className="mt-1 text-lg font-semibold text-slate-800">{currentDetail.uploaderName || currentDetail.uploaderId || 'N/A'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold text-slate-500">Thời gian đăng</p>
                <p className="mt-1 text-lg font-semibold text-slate-800">{formatDate(currentDetail.createdAt)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">Thông tin học tập</p>
              <p className="mt-2 text-base text-slate-700">
                {currentDetail.subject || 'Chưa có môn học'} | {currentDetail.major || 'Chưa có ngành'} | {currentDetail.school || 'Chưa có trường'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">Mô tả</p>
              <p className="mt-2 whitespace-pre-wrap text-base text-slate-700">{currentDetail.description || 'Không có mô tả.'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">Tệp tài liệu</p>
                  <button
                    type="button"
                    onClick={() => void handleOpenFile(false)}
                    className="mt-2 inline-block max-w-full break-all text-left text-base font-semibold text-blue-600 hover:underline"
                  >
                    {displayFileName}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpenFile(false)}
                  >
                    Mở tệp
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500">Dữ liệu chống trùng</p>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold">Nguồn upload:</span> {currentDetail.uploadSourceName || currentDetail.fileName || 'N/A'}</p>
                <p className="break-all"><span className="font-semibold">SHA-256:</span> {currentDetail.fileHash || 'Chưa có'}</p>
                <p className="break-all"><span className="font-semibold">duplicateOf:</span> {currentDetail.duplicateOf || 'Không có'}</p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500">Ghi chú kiểm duyệt</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base"
                placeholder="Nhập lý do phê duyệt hoặc từ chối..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
