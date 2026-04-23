import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { documentsApi, LearningDocument, type DocumentFileType } from '@/api/documents'
import { extractError } from '@/api/client'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { timeAgo } from '@/utils/format'

type Mode = 'saved' | 'mine'

function cannotPreviewMessage(type: DocumentFileType): string {
  if (type === 'DOC') return 'Không thể xem trước file Word trong ứng dụng.'
  return 'Không thể xem trước file PowerPoint trong ứng dụng.'
}

function getPreviewHint(type: DocumentFileType): string {
  if (type === 'PDF') return 'Cuộn trong khung để xem các trang tiếp theo.'
  if (type === 'DOC') return 'Tài liệu Word không hỗ trợ xem trước trực tiếp.'
  return 'Tài liệu PowerPoint không hỗ trợ xem trước trực tiếp.'
}

const typeClassMap: Record<DocumentFileType, string> = {
  PDF: 'bg-rose-500',
  DOC: 'bg-blue-500',
  PPT: 'bg-amber-500',
}

async function fetchDocumentBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Không thể tải file (${response.status})`)
  return response.blob()
}

export default function DocumentsCollectionPage({ mode }: { mode: Mode }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [previewDoc, setPreviewDoc] = useState<{
    id: string
    title: string
    fileUrl: string
    type: DocumentFileType
  } | null>(null)
  const [previewRemoteUrl, setPreviewRemoteUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [actionError, setActionError] = useState('')

  const isSavedPage = mode === 'saved'
  const title = isSavedPage ? 'Tài liệu đã lưu' : 'Tài liệu đã tải lên'
  const description = isSavedPage
    ? 'Danh sách tài liệu bạn đã lưu để xem lại.'
    : 'Danh sách tài liệu bạn đã đăng tải.'
  const queryKey = isSavedPage ? ['documents-saved'] : ['documents-mine']

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 1 }) =>
      isSavedPage ? documentsApi.listSaved(pageParam as number, 20) : documentsApi.listMine(pageParam as number, 20),
    getNextPageParam: (lastPage) => (lastPage.meta?.hasNext ? (lastPage.meta.page + 1) : undefined),
    initialPageParam: 1,
  })

  const saveMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.toggleSave(documentId),
    onSuccess: async (result) => {
      toast.success(result.saved ? 'Đã lưu tài liệu' : 'Đã bỏ lưu tài liệu')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['documents-library'] }),
      ])
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const documents = data?.pages.flatMap((page) => page.data) ?? []

  useEffect(() => {
    if (!previewDoc || previewDoc.type !== 'PDF') {
      setPreviewLoading(false)
      setPreviewError('')
      setPreviewRemoteUrl('')
      return
    }

    let active = true
    setPreviewLoading(true)
    setPreviewError('')

    documentsApi
      .getAccessUrl(previewDoc.id)
      .then((url) => {
        if (!active) return
        setPreviewRemoteUrl(url)
      })
      .catch((err) => {
        if (!active) return
        setPreviewError(extractError(err))
      })
      .finally(() => {
        if (active) setPreviewLoading(false)
      })

    return () => {
      active = false
    }
  }, [previewDoc])

  const handleDownload = async (doc: LearningDocument) => {
    setActionError('')
    try {
      await documentsApi.recordDownload(doc.id)

      if (doc.type === 'PDF') {
        const url = await documentsApi.getAccessUrl(doc.id, true)
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const blob = await fetchDocumentBlob(doc.fileUrl)
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = doc.fileName || `${doc.title}.${doc.type.toLowerCase()}`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      }

      await queryClient.invalidateQueries({ queryKey })
    } catch (err) {
      setActionError(extractError(err))
    }
  }

  const handlePreviewOpen = async (doc: LearningDocument) => {
    setActionError('')

    try {
      await documentsApi.recordView(doc.id)
      await queryClient.invalidateQueries({ queryKey })
    } catch (err) {
      setActionError(extractError(err))
    }

    setPreviewDoc({
      id: doc.id,
      title: doc.title,
      fileUrl: doc.fileUrl,
      type: doc.type,
    })
  }

  return (
    <section className='documents-page-shell rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)] sm:p-4'>
      <div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-3xl font-black tracking-tight text-slate-800 sm:text-4xl'>{title}</h1>
          <p className='mt-1 text-sm text-slate-500 sm:text-base'>{description}</p>
        </div>
        <div className='flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-center sm:justify-end'>
          <div className='flex w-full gap-2 overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0'>
            <button
              type='button'
              onClick={() => navigate('/documents')}
              className='inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
            >
              Kho tài liệu
            </button>
            <button
              type='button'
              onClick={() => navigate('/documents/saved')}
              className={`inline-flex shrink-0 items-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                isSavedPage ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Tài liệu đã lưu
            </button>
            <button
              type='button'
              onClick={() => navigate('/documents/mine')}
              className={`inline-flex shrink-0 items-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                !isSavedPage ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Tài liệu đã tải lên
            </button>
          </div>
          <button
            type='button'
            onClick={() => navigate('/documents')}
            className='group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 sm:w-auto'
          >
            <span className='text-base leading-none transition group-hover:rotate-90'>+</span>
            Đăng tài liệu
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className='rounded-xl border border-slate-200 bg-white py-10 text-center text-sm font-medium text-slate-500'>
          Đang tải tài liệu...
        </div>
      ) : isError ? (
        <EmptyState
          title='Không thể tải danh sách tài liệu'
          description='Có lỗi xảy ra. Vui lòng thử lại.'
          action={
            <Button variant='secondary' onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : documents.length === 0 ? (
        <EmptyState
          title={isSavedPage ? 'Bạn chưa lưu tài liệu nào' : 'Bạn chưa tải lên tài liệu nào'}
          description={isSavedPage ? 'Nhấn Lưu tài liệu để xem lại tại đây.' : 'Hãy đăng tài liệu đầu tiên trong kho tài liệu.'}
        />
      ) : (
        <>
          <div className='documents-cards-grid'>
            {documents.map((doc) => (
              <article key={doc.id} className='documents-card rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-3'>
                <div className='documents-card-main flex items-start gap-3'>
                  <div className='relative mt-0.5 flex-shrink-0'>
                    <div className={`grid h-[64px] w-[46px] place-items-center rounded-[10px] text-sm font-extrabold text-white sm:h-[60px] sm:w-[42px] sm:text-xs ${typeClassMap[doc.type]}`}>
                      {doc.type}
                    </div>
                    <span className='absolute right-0 top-0 h-3 w-3 rounded-bl-md bg-white/35' />
                  </div>

                  <div className='documents-card-content min-w-0 flex-1'>
                    <h3 className='documents-card-title line-clamp-2 text-xl font-bold leading-tight text-slate-800 sm:text-[22px]'>{doc.title}</h3>
                    <div className='documents-card-meta-row mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[15px] text-slate-500 sm:text-sm'>
                      <span>{doc.subject ? `Môn: ${doc.subject}` : 'Môn: Chưa cập nhật'}</span>
                      <span className='font-semibold text-blue-600'>{doc.major || 'Chưa cập nhật ngành'}</span>
                    </div>
                    <div className='documents-card-meta-row mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[15px] text-slate-500 sm:text-sm'>
                      <span>{doc.school || 'Chưa cập nhật trường'}</span>
                      <span>{doc.cohort || 'Chưa cập nhật khóa'}</span>
                    </div>

                    <div className='documents-card-meta-row mt-3 flex flex-wrap items-center gap-2 text-[13px] text-slate-500 sm:text-xs'>
                      <Avatar src={doc.uploaderAvatar} name={doc.uploaderName || 'Người dùng EduSocial'} size='xs' />
                      <span>Người đăng:</span>
                      <span className='font-semibold text-slate-600'>{doc.uploaderName || 'Người dùng EduSocial'}</span>
                      <span>•</span>
                      <span>{timeAgo(doc.createdAt)}</span>
                      {!isSavedPage && doc.status !== 'ACTIVE' && (
                        <>
                          <span>•</span>
                          <span className='font-semibold text-amber-600'>{doc.status}</span>
                        </>
                      )}
                    </div>

                    <div className='documents-card-footer'>
                      <div className='documents-card-actions mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2'>
                      <button
                        type='button'
                        onClick={() => void handleDownload(doc)}
                        className='inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700'
                      >
                        <span>↓</span>
                        <span>Tải xuống</span>
                      </button>
                      <button
                        type='button'
                        onClick={() => void handlePreviewOpen(doc)}
                        className='inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                      >
                        <span>◉</span>
                        <span>Xem trước</span>
                      </button>
                      {isSavedPage && (
                        <button
                          type='button'
                          onClick={() => saveMutation.mutate(doc.id)}
                          disabled={saveMutation.isPending}
                          className='inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:col-span-2'
                        >
                          Bỏ lưu
                        </button>
                      )}
                    </div>

                    <div className='mt-2 flex flex-wrap gap-2 text-[13px] text-slate-500 sm:text-xs'>
                      <span>{doc.views.toLocaleString('vi-VN')} lượt xem</span>
                      <span>•</span>
                      <span>{doc.downloads.toLocaleString('vi-VN')} lượt tải</span>
                    </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {hasNextPage && (
            <div className='mt-3 flex justify-center'>
              <Button variant='secondary' onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                {isFetchingNextPage ? 'Đang tải...' : 'Tải thêm'}
              </Button>
            </div>
          )}
        </>
      )}

      {actionError && (
        <p className='mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700'>
          {actionError}
        </p>
      )}

      <div
        className={`fixed inset-0 z-[72] transition ${previewDoc ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!previewDoc}
      >
        <div className='absolute inset-0 bg-slate-900/55 backdrop-blur-[1px]' onClick={() => setPreviewDoc(null)} />
        <div className='absolute left-1/2 top-1/2 w-[95vw] max-w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5'>
          <div className='mb-3 flex items-start justify-between gap-4'>
            <div>
              <h2 className='text-lg font-extrabold text-slate-800 sm:text-xl'>Xem trước tài liệu</h2>
              <p className='mt-1 text-sm text-slate-500'>{previewDoc?.title ?? ''}</p>
            </div>
            <button type='button' onClick={() => setPreviewDoc(null)} className='grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100'>
              x
            </button>
          </div>

          {previewDoc && (
            <div className='rounded-xl border border-slate-200 bg-slate-50 p-2'>
              {previewDoc.type === 'PDF' ? (
                previewLoading ? (
                  <div className='grid h-[62vh] place-items-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-500'>
                    Đang tải bản xem trước...
                  </div>
                ) : previewError ? (
                  <div className='grid h-[62vh] place-items-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-center text-sm font-medium text-rose-700'>
                    {previewError}
                  </div>
                ) : (
                  <iframe title='document-preview' src={previewRemoteUrl} className='h-[62vh] w-full rounded-lg border border-slate-200 bg-white' />
                )
              ) : (
                <div className='grid h-[62vh] place-items-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-center text-sm font-medium text-amber-800'>
                  {cannotPreviewMessage(previewDoc.type)}
                </div>
              )}
              <p className='mt-2 text-xs font-medium text-slate-500'>{getPreviewHint(previewDoc.type)}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
