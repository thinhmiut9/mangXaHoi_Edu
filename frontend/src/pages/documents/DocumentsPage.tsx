import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { documentsApi, type DocumentFileType } from '@/api/documents'
import { extractError } from '@/api/client'
import { chatApi } from '@/api/index'
import { friendsApi, usersApi } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { useAuthStore } from '@/store/authStore'

async function fetchDocumentBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Không thể tải file (${response.status})`)
  return response.blob()
}

function formatRelativeTime(dateInput?: string): string {
  if (!dateInput) return 'Không rõ thời gian'

  const target = Date.parse(dateInput)
  if (!Number.isFinite(target)) return 'Không rõ thời gian'

  const diffMs = Date.now() - target
  if (diffMs < 60 * 1000) return 'Vừa xong'

  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 60) return `${minutes} phút trước`

  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  if (hours < 24) return `${hours} giờ trước`

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (days < 7) return `${days} ngày trước`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} tuần trước`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} tháng trước`

  const years = Math.floor(days / 365)
  return `${years} năm trước`
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

function cannotPreviewMessage(type: DocumentFileType): string {
  if (type === 'DOC') return 'Không thể xem trước file Word trong ứng dụng.'
  return 'Không thể xem trước file PowerPoint trong ứng dụng.'
}

type FilterOption = {
  value: string
  label: string
}

type UploadSuggestField = 'subject' | 'major' | 'school' | 'cohort'

function FilterDropdown({
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
}: {
  value: string
  options: FilterOption[]
  isOpen: boolean
  onToggle: () => void
  onSelect: (value: string) => void
}) {
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className='relative' data-doc-filter>
      <button
        type='button'
        onClick={onToggle}
        className='flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition hover:border-blue-300 focus:border-blue-300'
      >
        <span className='truncate'>{selected?.label ?? ''}</span>
        <span className={`ml-2 text-xs text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className='absolute left-0 top-[calc(100%+6px)] z-20 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg'>
          <div className='max-h-[132px] overflow-y-auto py-1'>
            {options.map((option) => (
              <button
                key={option.value}
                type='button'
                onClick={() => onSelect(option.value)}
                className={`flex min-h-11 w-full items-center px-3 text-left text-sm transition ${
                  option.value === value ? 'bg-blue-50 font-semibold text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className='truncate'>{option.label}</span>
              </button>
            ))}
          </div>
          </div>
        )}
    </div>
  )
}

export default function DocumentsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [filterSchool, setFilterSchool] = useState('ALL')
  const [filterMajor, setFilterMajor] = useState('ALL')
  const [filterType, setFilterType] = useState<'ALL' | DocumentFileType>('ALL')
  const [filterTime, setFilterTime] = useState<'ALL' | '7D' | '30D' | '90D'>('ALL')
  const [sortBy, setSortBy] = useState<'NEWEST' | 'POPULAR' | 'RATING'>('NEWEST')
  const [openDropdown, setOpenDropdown] = useState<null | 'school' | 'major' | 'type' | 'time' | 'sort'>(null)
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null)
  const [shareDoc, setShareDoc] = useState<{ id: string; title: string } | null>(null)
  const [shareKeyword, setShareKeyword] = useState('')
  const [shareUserId, setShareUserId] = useState('')

  const [openUpload, setOpenUpload] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{
    id: string
    title: string
    fileUrl: string
    previewUrl?: string
    type: DocumentFileType
  } | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState('')
  const [previewRemoteUrl, setPreviewRemoteUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [openUploadSuggest, setOpenUploadSuggest] = useState<UploadSuggestField | null>(null)
  const uploadSuggestRefs = useRef<Record<UploadSuggestField, HTMLDivElement | null>>({
    subject: null,
    major: null,
    school: null,
    cohort: null,
  })
  const uploadSuggestAutoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uploadData, setUploadData] = useState({
    title: '',
    subject: '',
    major: '',
    school: '',
    cohort: '',
    tags: '',
    type: 'PDF' as DocumentFileType,
  })

  const shortenedFileName = useMemo(() => {
    if (!selectedFileName) return ''
    const maxLength = 58
    if (selectedFileName.length <= maxLength) return selectedFileName
    return `${selectedFileName.slice(0, maxLength - 1)}…`
  }, [selectedFileName])

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['documents-library'],
    queryFn: () =>
      documentsApi.list({
        q: '',
        school: '',
        major: '',
        fileType: '',
        timeRange: 'ALL',
        sortBy: 'NEWEST',
        page: 1,
        limit: 50,
      }),
  })

  const { data: facetData } = useQuery({
    queryKey: ['documents-facets'],
    queryFn: () =>
      documentsApi.list({
        q: '',
        school: '',
        major: '',
        fileType: '',
        timeRange: 'ALL',
        sortBy: 'NEWEST',
        page: 1,
        limit: 50,
      }),
  })

  const { data: friendUsers = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: friendsApi.getFriends,
    enabled: !!shareDoc,
  })

  const { data: searchedUsers = [], isFetching: isSearchingUsers } = useQuery({
    queryKey: ['document-share-users', shareKeyword],
    queryFn: async () => {
      const result = await usersApi.searchUsers(shareKeyword.trim(), 1)
      return result.data ?? []
    },
    enabled: !!shareDoc && shareKeyword.trim().length >= 2,
  })

  const uploadMutation = useMutation({
    mutationFn: documentsApi.create,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['documents'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-library'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-facets'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-mine'] }),
      ])
      setUploadData({
        title: '',
        subject: '',
        major: '',
        school: '',
        cohort: '',
        tags: '',
        type: 'PDF',
      })
      setSelectedFile(null)
      setSelectedFileName('')
      setUploadError('')
      setOpenUpload(false)
      toast.success('Tài liệu đã được gửi lên và đang chờ admin duyệt')
      navigate('/documents/mine')
    },
  })

  const saveMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.toggleSave(documentId),
    onSuccess: async (result) => {
      toast.success(result.saved ? 'Đã lưu tài liệu' : 'Đã bỏ lưu tài liệu')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['documents-library'] }),
        queryClient.invalidateQueries({ queryKey: ['documents-facets'] }),
      ])
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const shareMutation = useMutation({
    mutationFn: async ({ userId, documentId, title }: { userId: string; documentId: string; title: string }) => {
      const conversation = await chatApi.getOrCreateConversation(userId)
      const documentUrl = `${window.location.origin}/documents?documentId=${documentId}`
      const message = `📚 ${title}\n${documentUrl}`
      await chatApi.sendMessage(conversation.id, message)
      return conversation.id
    },
    onSuccess: () => {
      toast.success('Đã chia sẻ tài liệu qua tin nhắn')
      setShareDoc(null)
      setShareKeyword('')
      setShareUserId('')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const refreshDocuments = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['documents-library'] }),
      queryClient.invalidateQueries({ queryKey: ['documents-facets'] }),
    ])
  }

  const allDocuments = useMemo(
    () => (data?.data ?? []).filter((doc) => doc.status === 'ACTIVE'),
    [data?.data]
  )
  const collectUploadOptions = (field: UploadSuggestField) => {
    const values = [...(facetData?.data ?? []), ...allDocuments]
      .map((doc) => doc[field])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
  }
  const subjectOptions = useMemo(() => collectUploadOptions('subject'), [allDocuments, facetData?.data])
  const majorOptions = useMemo(() => {
    return collectUploadOptions('major')
  }, [allDocuments, facetData?.data])
  const schoolOptions = useMemo(() => {
    return collectUploadOptions('school')
  }, [allDocuments, facetData?.data])
  const cohortOptions = useMemo(() => {
    return collectUploadOptions('cohort')
  }, [allDocuments, facetData?.data])
  const uploadSuggestOptions = useMemo<Record<UploadSuggestField, string[]>>(
    () => ({
      subject: subjectOptions,
      major: majorOptions,
      school: schoolOptions,
      cohort: cohortOptions,
    }),
    [cohortOptions, majorOptions, schoolOptions, subjectOptions]
  )
  const schoolFilterOptions = useMemo<FilterOption[]>(
    () => [{ value: 'ALL', label: 'Lọc theo trường' }, ...schoolOptions.map((school) => ({ value: school, label: school }))],
    [schoolOptions]
  )
  const majorFilterOptions = useMemo<FilterOption[]>(
    () => [{ value: 'ALL', label: 'Lọc theo ngành' }, ...majorOptions.map((major) => ({ value: major, label: major }))],
    [majorOptions]
  )
  const typeFilterOptions: FilterOption[] = [
    { value: 'ALL', label: 'Loại file' },
    { value: 'PDF', label: 'PDF' },
    { value: 'DOC', label: 'DOC / DOCX' },
    { value: 'PPT', label: 'PPT / PPTX' },
  ]
  const timeFilterOptions: FilterOption[] = [
    { value: 'ALL', label: 'Thời gian đăng' },
    { value: '7D', label: '7 ngày gần đây' },
    { value: '30D', label: '30 ngày gần đây' },
    { value: '90D', label: '90 ngày gần đây' },
  ]
  const sortOptions: FilterOption[] = [
    { value: 'NEWEST', label: 'Mới nhất' },
    { value: 'POPULAR', label: 'Nhiều lượt xem' },
    { value: 'RATING', label: 'Nhiều lượt tải' },
  ]
  const shareUserCandidates = useMemo(() => {
    const source = shareKeyword.trim().length >= 2 ? searchedUsers : friendUsers
    const dedup = new Map<string, (typeof source)[number]>()
    for (const item of source) {
      if (item?.id && item.id !== user?.id) dedup.set(item.id, item)
    }
    return Array.from(dedup.values())
  }, [friendUsers, searchedUsers, shareKeyword, user?.id])

  const documents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const now = Date.now()

    const filtered = allDocuments.filter((doc) => {
      const searchableValues = [
        doc.title,
        doc.subject,
        doc.school,
        doc.major,
        doc.cohort,
        doc.description,
        ...(doc.tags ?? []),
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

      const matchesQuery = !normalizedQuery || searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery))
      const matchesSchool = filterSchool === 'ALL' || (doc.school ?? '') === filterSchool
      const matchesMajor = filterMajor === 'ALL' || (doc.major ?? '') === filterMajor
      const matchesType = filterType === 'ALL' || doc.type === filterType

      const createdAtTime = Date.parse(doc.createdAt || '')
      const matchesTime =
        filterTime === 'ALL' ||
        (Number.isFinite(createdAtTime) &&
          ((filterTime === '7D' && now - createdAtTime <= 7 * 24 * 60 * 60 * 1000) ||
            (filterTime === '30D' && now - createdAtTime <= 30 * 24 * 60 * 60 * 1000) ||
            (filterTime === '90D' && now - createdAtTime <= 90 * 24 * 60 * 60 * 1000)))

      return matchesQuery && matchesSchool && matchesMajor && matchesType && matchesTime
    })

    filtered.sort((a, b) => {
      if (sortBy === 'POPULAR') {
        if (b.views !== a.views) return b.views - a.views
        return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
      }
      if (sortBy === 'RATING') {
        if (b.downloads !== a.downloads) return b.downloads - a.downloads
        if (b.views !== a.views) return b.views - a.views
        return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
      }
      return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
    })

    return filtered
  }, [allDocuments, filterMajor, filterSchool, filterTime, filterType, query, sortBy])

  const previewUrl =
    previewDoc?.type === 'PDF'
      ? previewRemoteUrl || previewBlobUrl
      : ''

  useEffect(() => {
    if (!previewDoc || previewDoc.type !== 'PDF') {
      setPreviewLoading(false)
      setPreviewError('')
      setPreviewRemoteUrl('')
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl)
        setPreviewBlobUrl('')
      }
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

  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
    }
  }, [previewBlobUrl])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-doc-filter]')) return
      setOpenDropdown(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!openUploadSuggest) return
      if (!uploadSuggestRefs.current[openUploadSuggest]?.contains(target)) {
        setOpenUploadSuggest(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openUploadSuggest])

  useEffect(() => {
    if (!openUpload) setOpenUploadSuggest(null)
  }, [openUpload])

  useEffect(() => {
    if (!shareDoc) {
      setShareKeyword('')
      setShareUserId('')
      return
    }
    if (shareUserId && shareUserCandidates.some((user) => user.id === shareUserId)) return
    setShareUserId(shareUserCandidates[0]?.id ?? '')
  }, [shareDoc, shareUserCandidates, shareUserId])

  useEffect(() => {
    if (uploadSuggestAutoCloseRef.current) {
      clearTimeout(uploadSuggestAutoCloseRef.current)
      uploadSuggestAutoCloseRef.current = null
    }

    if (!openUploadSuggest) return

    uploadSuggestAutoCloseRef.current = setTimeout(() => {
      setOpenUploadSuggest(null)
    }, 2500)

    return () => {
      if (uploadSuggestAutoCloseRef.current) {
        clearTimeout(uploadSuggestAutoCloseRef.current)
        uploadSuggestAutoCloseRef.current = null
      }
    }
  }, [openUploadSuggest, uploadData])

  const clearFilters = () => {
    setSearchText('')
    setQuery('')
    setFilterSchool('ALL')
    setFilterMajor('ALL')
    setFilterType('ALL')
    setFilterTime('ALL')
    setSortBy('NEWEST')
  }

  const applySearch = () => {
    setQuery(searchText.trim())
  }

  const handleUploadSubmit = (event: FormEvent) => {
    event.preventDefault()
    setUploadError('')
    if (!selectedFile) {
      setUploadError('Vui lòng chọn file trước khi đăng.')
      return
    }

    uploadMutation.mutate({
      file: selectedFile,
      title: uploadData.title,
      subject: uploadData.subject,
      school: uploadData.school,
      major: uploadData.major,
      cohort: uploadData.cohort,
      tags: uploadData.tags,
    })
  }

  const renderUploadSuggestInput = ({
    field,
    label,
    placeholder,
  }: {
    field: UploadSuggestField
    label: string
    placeholder: string
  }) => {
    const value = uploadData[field]
    const options = uploadSuggestOptions[field]
    const keyword = value.trim().toLowerCase()
    const suggestions = (!keyword ? options : options.filter((option) => option.toLowerCase().includes(keyword))).slice(0, 8)
    const hasExactMatch = !!keyword && options.some((option) => option.toLowerCase() === keyword)
    const isOpen = openUploadSuggest === field

    return (
      <div
        className='relative min-w-0'
        ref={(node) => {
          uploadSuggestRefs.current[field] = node
        }}
      >
        <span className='mb-1 block text-sm font-semibold text-slate-700'>{label}</span>
        <input
          value={value}
          onFocus={() => setOpenUploadSuggest(field)}
          onBlur={() => {
            window.setTimeout(() => setOpenUploadSuggest((prev) => (prev === field ? null : prev)), 120)
          }}
          onChange={(e) => {
            const nextValue = e.target.value
            setUploadData((prev) => ({ ...prev, [field]: nextValue }))
            setOpenUploadSuggest(field)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpenUploadSuggest((prev) => (prev === field ? null : prev))
            if (e.key === 'Enter' || e.key === 'Tab') {
              setUploadData((prev) => ({ ...prev, [field]: prev[field].trim() }))
              setOpenUploadSuggest((prev) => (prev === field ? null : prev))
            }
          }}
          className='h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-300'
          placeholder={placeholder}
          autoComplete='off'
        />

        {isOpen && (
          <div className='absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg'>
            <div className='max-h-44 overflow-y-auto py-1'>
              {suggestions.map((option) => (
                <button
                  key={option}
                  type='button'
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setUploadData((prev) => ({ ...prev, [field]: option }))
                    setOpenUploadSuggest(null)
                  }}
                  className='flex min-h-10 w-full items-center px-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 active:bg-blue-50'
                >
                  <span className='truncate'>{option}</span>
                </button>
              ))}

              {value.trim() && !hasExactMatch && (
                <button
                  type='button'
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setUploadData((prev) => ({ ...prev, [field]: prev[field].trim() }))
                    setOpenUploadSuggest(null)
                  }}
                  className='flex min-h-10 w-full items-center border-t border-slate-100 px-3 text-left text-sm font-semibold text-blue-600 transition hover:bg-blue-50 active:bg-blue-100'
                >
                  <span className='truncate'>Dùng giá trị mới: {value.trim()}</span>
                </button>
              )}

              {!suggestions.length && !value.trim() && (
                <div className='px-3 py-2 text-sm text-slate-400'>Nhập để tìm hoặc thêm mới...</div>
              )}
            </div>
            {value.trim() && !hasExactMatch && (
              <div className='border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500'>
                Nhấn Enter hoặc rời ô để dùng giá trị bạn vừa nhập.
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const handleOpenOriginal = async () => {
    if (!previewDoc) return
    setActionError('')

    try {
      await documentsApi.recordView(previewDoc.id)
      await refreshDocuments()

      if (previewDoc.type === 'PDF') {
        const url = await documentsApi.getAccessUrl(previewDoc.id)
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }

      window.open(previewDoc.fileUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setActionError(extractError(err))
    }
  }

  const handleDownload = async (documentId: string, fileName: string) => {
    setActionError('')

    try {
      const doc = allDocuments.find((item) => item.id === documentId)
      if (!doc) throw new Error('Không tìm thấy tài liệu để tải')
      await documentsApi.recordDownload(documentId)
      await refreshDocuments()

      if (doc.type === 'PDF') {
        const url = await documentsApi.getAccessUrl(documentId, true)
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }

      const blob = await fetchDocumentBlob(doc.fileUrl)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (err) {
      setActionError(extractError(err))
    }
  }

  const handlePreviewOpen = async (doc: (typeof allDocuments)[number]) => {
    setActionError('')

    try {
      await documentsApi.recordView(doc.id)
      await refreshDocuments()
    } catch (err) {
      setActionError(extractError(err))
    }

    setPreviewDoc({
      id: doc.id,
      title: doc.title,
      fileUrl: doc.fileUrl,
      previewUrl: doc.previewUrl,
      type: doc.type,
    })
  }

  return (
    <>
      <section className='documents-page-shell rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)] sm:p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h1 className='text-3xl font-black tracking-tight text-slate-800 sm:text-4xl'>Kho tài liệu</h1>
            <p className='mt-1 text-sm text-slate-500 sm:text-base'>Tìm và chia sẻ tài liệu theo ngành, trường, môn học</p>
          </div>
          <div className='flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-center sm:justify-end'>
            <div className='flex w-full gap-2 overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0'>
              <button
                type='button'
                onClick={() => navigate('/documents/saved')}
                className='inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
              >
                Tài liệu đã lưu
              </button>
              <button
                type='button'
                onClick={() => navigate('/documents/mine')}
                className='inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
              >
                Tài liệu đã tải lên
              </button>
            </div>
            <button
              type='button'
              onClick={() => setOpenUpload(true)}
              className='group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 sm:w-auto'
            >
              <span className='text-base leading-none transition group-hover:rotate-90'>+</span>
              Đăng tài liệu
            </button>
          </div>
        </div>

        <div className='documents-search-panel mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:flex-row sm:items-center'>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applySearch()
            }}
            placeholder='Tìm theo tên tài liệu, môn học, ngành, trường...'
            className='h-10 w-full rounded-lg border border-slate-200 px-3 text-[15px] text-slate-700 outline-none focus:border-blue-300'
          />
          <button type='button' onClick={applySearch} className='h-11 rounded-lg border border-yellow-400 bg-gradient-to-b from-yellow-300 to-amber-300 px-4 text-sm font-semibold text-slate-800 sm:h-10'>
            Tìm kiếm
          </button>
        </div>

        <div className='documents-filter-panel mt-2 grid gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2 lg:grid-cols-5'>
          <FilterDropdown
            value={filterSchool}
            options={schoolFilterOptions}
            isOpen={openDropdown === 'school'}
            onToggle={() => setOpenDropdown((current) => (current === 'school' ? null : 'school'))}
            onSelect={(value) => {
              setFilterSchool(value)
              setOpenDropdown(null)
            }}
          />

          <FilterDropdown
            value={filterMajor}
            options={majorFilterOptions}
            isOpen={openDropdown === 'major'}
            onToggle={() => setOpenDropdown((current) => (current === 'major' ? null : 'major'))}
            onSelect={(value) => {
              setFilterMajor(value)
              setOpenDropdown(null)
            }}
          />

          <FilterDropdown
            value={filterType}
            options={typeFilterOptions}
            isOpen={openDropdown === 'type'}
            onToggle={() => setOpenDropdown((current) => (current === 'type' ? null : 'type'))}
            onSelect={(value) => {
              setFilterType(value as 'ALL' | DocumentFileType)
              setOpenDropdown(null)
            }}
          />

          <FilterDropdown
            value={filterTime}
            options={timeFilterOptions}
            isOpen={openDropdown === 'time'}
            onToggle={() => setOpenDropdown((current) => (current === 'time' ? null : 'time'))}
            onSelect={(value) => {
              setFilterTime(value as 'ALL' | '7D' | '30D' | '90D')
              setOpenDropdown(null)
            }}
          />

          <div className='flex items-center gap-2'>
            <div className='flex-1'>
              <FilterDropdown
                value={sortBy}
                options={sortOptions}
                isOpen={openDropdown === 'sort'}
                onToggle={() => setOpenDropdown((current) => (current === 'sort' ? null : 'sort'))}
                onSelect={(value) => {
                  setSortBy(value as 'NEWEST' | 'POPULAR' | 'RATING')
                  setOpenDropdown(null)
                }}
              />
            </div>
            <button type='button' onClick={clearFilters} className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600'>
              Xóa
            </button>
          </div>
        </div>

        <div className='hidden mt-2 grid gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2 lg:grid-cols-5'>
          <select
            value={filterSchool}
            onChange={(e) => setFilterSchool(e.target.value)}
            className='h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-300'
          >
            <option value='ALL'>Lọc theo trường</option>
            {schoolOptions.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>

          <select
            value={filterMajor}
            onChange={(e) => setFilterMajor(e.target.value)}
            className='h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-300'
          >
            <option value='ALL'>Lọc theo ngành</option>
            {majorOptions.map((major) => (
              <option key={major} value={major}>
                {major}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'ALL' | DocumentFileType)}
            className='h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-300'
          >
            <option value='ALL'>Loại file</option>
            <option value='PDF'>PDF</option>
            <option value='DOC'>DOC / DOCX</option>
            <option value='PPT'>PPT / PPTX</option>
          </select>

          <select
            value={filterTime}
            onChange={(e) => setFilterTime(e.target.value as 'ALL' | '7D' | '30D' | '90D')}
            className='h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-300'
          >
            <option value='ALL'>Thời gian đăng</option>
            <option value='7D'>7 ngày gần đây</option>
            <option value='30D'>30 ngày gần đây</option>
            <option value='90D'>90 ngày gần đây</option>
          </select>

          <div className='flex items-center gap-2'>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'NEWEST' | 'POPULAR' | 'RATING')}
              className='h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-300'
            >
              <option value='NEWEST'>Mới nhất</option>
              <option value='POPULAR'>Nhiều lượt xem</option>
              <option value='RATING'>Nhiều lượt tải</option>
            </select>
            <button type='button' onClick={clearFilters} className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600'>
              Xóa
            </button>
          </div>
        </div>

        <div className='documents-cards-grid mt-3'>
          {(isLoading || isFetching) && (
            <div className='rounded-xl border border-slate-200 bg-white py-8 text-center text-sm font-medium text-slate-500'>
              Đang tải tài liệu...
            </div>
          )}
          {error && (
            <div className='rounded-xl border border-rose-200 bg-rose-50 px-3 py-4 text-sm font-medium text-rose-700'>
              {extractError(error)}
            </div>
          )}

          {!isLoading && !error && documents.length === 0 && (
            <div className='rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm font-medium text-slate-500'>
              Không có tài liệu phù hợp với bộ lọc hiện tại.
            </div>
          )}

          {!isLoading &&
            !error &&
            documents.map((doc) => (
            <article key={doc.id} className='documents-card rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:shadow-md sm:p-3'>
              <div className='documents-card-main flex items-start gap-3'>
                <div className='relative mt-0.5 flex-shrink-0'>
                  <div className={`grid h-[64px] w-[46px] place-items-center rounded-[10px] text-sm font-extrabold text-white sm:h-[60px] sm:w-[42px] sm:text-xs ${typeClassMap[doc.type]}`}>
                    {doc.type}
                  </div>
                  <span className='absolute right-0 top-0 h-3 w-3 rounded-bl-md bg-white/35' />
                </div>

                <div className='documents-card-content min-w-0 flex-1'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <h3 className='line-clamp-2 text-xl font-bold leading-tight text-slate-800 sm:truncate sm:text-[22px]'>{doc.title}</h3>
                      <div className='mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[15px] text-slate-500 sm:text-sm'>
                        <span>{doc.subject ? `Môn: ${doc.subject}` : 'Môn: Chưa cập nhật'}</span>
                        <span className='font-semibold text-blue-600'>{doc.major || 'Chưa cập nhật ngành'}</span>
                      </div>
                      <div className='mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[15px] text-slate-500 sm:text-sm'>
                        <span>{doc.school || 'Chưa cập nhật trường'}</span>
                        <span>{doc.cohort || 'Chưa cập nhật khóa'}</span>
                      </div>
                    </div>

                    <div className='relative'>
                      <button
                        type='button'
                        onClick={() => setOpenCardMenuId((current) => (current === doc.id ? null : doc.id))}
                        className='grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 sm:h-8 sm:w-8'
                        aria-label='Tùy chọn tài liệu'
                        aria-expanded={openCardMenuId === doc.id}
                      >
                        ...
                      </button>
                      {openCardMenuId === doc.id && (
                        <div className='absolute right-0 top-[calc(100%+6px)] z-20 min-w-[150px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg'>
                          <button
                            type='button'
                            onClick={() => {
                              setOpenCardMenuId(null)
                              saveMutation.mutate(doc.id)
                            }}
                            disabled={saveMutation.isPending}
                            className='flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50'
                          >
                            <span>□</span>
                            <span>{doc.isSaved ? 'Bỏ lưu tài liệu' : 'Lưu tài liệu'}</span>
                          </button>
                          <button
                            type='button'
                            onClick={() => {
                              setOpenCardMenuId(null)
                              setShareDoc({ id: doc.id, title: doc.title })
                            }}
                            className='flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50'
                          >
                            <span>↗</span>
                            <span>Chia sẻ</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='mt-3 flex flex-wrap items-center gap-2 text-[13px] text-slate-500 sm:text-xs'>
                    <Avatar src={doc.uploaderAvatar} name={doc.uploaderName || 'Người dùng EduSocial'} size='xs' />
                    <span>Người đăng:</span>
                    <span className='font-semibold text-slate-600'>{doc.uploaderName || 'Người dùng EduSocial'}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(doc.createdAt)}</span>
                  </div>

                  {!!(doc.tags ?? []).length && (
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {(doc.tags ?? []).map((tag) => (
                        <span key={tag} className='text-xs font-semibold text-indigo-500'>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className='documents-card-footer'>
                    <div className='documents-card-actions mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center'>
                      <button
                        type='button'
                        onClick={() => handleDownload(doc.id, doc.fileName || `${doc.title}.${doc.type.toLowerCase()}`)}
                        className='inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 sm:h-auto sm:w-auto sm:justify-start sm:py-1.5 sm:text-xs'
                      >
                        <span>↓</span>
                        <span>Tải xuống</span>
                      </button>
                      <button
                        type='button'
                        onClick={() => void handlePreviewOpen(doc)}
                        className='inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:h-auto sm:w-auto sm:justify-start sm:py-1.5 sm:text-xs'
                      >
                        <span>◉</span>
                        <span>Xem trước</span>
                      </button>
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
      </section>

      <div
        className={`fixed inset-0 z-[71] transition ${shareDoc ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!shareDoc}
      >
        <div className='absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]' onClick={() => setShareDoc(null)} />
        <div className='absolute left-1/2 top-1/2 max-h-[88vh] w-[94vw] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5'>
          <div className='mb-3 flex items-start justify-between gap-4'>
            <div>
              <h2 className='text-lg font-extrabold text-slate-800 sm:text-xl'>Chia sẻ qua tin nhắn</h2>
              <p className='mt-1 line-clamp-1 text-sm text-slate-500'>{shareDoc?.title ?? ''}</p>
            </div>
            <button
              type='button'
              onClick={() => setShareDoc(null)}
              className='grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100'
              aria-label='Đóng chia sẻ'
            >
              x
            </button>
          </div>

          <input
            value={shareKeyword}
            onChange={(e) => setShareKeyword(e.target.value)}
            placeholder='Tìm người dùng...'
            className='h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-300'
          />

          <div className='mt-3 max-h-[44vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-1'>
            {isSearchingUsers && shareKeyword.trim().length >= 2 && (
              <div className='px-3 py-2 text-sm text-slate-500'>Đang tìm người dùng...</div>
            )}

            {!isSearchingUsers && shareUserCandidates.length === 0 && (
              <div className='px-3 py-2 text-sm text-slate-500'>
                {shareKeyword.trim().length >= 2 ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có danh sách người dùng để chia sẻ.'}
              </div>
            )}

            {shareUserCandidates.map((targetUser) => (
              <button
                key={targetUser.id}
                type='button'
                onClick={() => setShareUserId(targetUser.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                  shareUserId === targetUser.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-white'
                }`}
              >
                <Avatar src={targetUser.avatar} name={targetUser.displayName || 'Người dùng'} size='sm' />
                <div className='min-w-0'>
                  <p className='truncate text-sm font-semibold text-slate-700'>{targetUser.displayName || 'Người dùng'}</p>
                  <p className='truncate text-xs text-slate-500'>@{targetUser.username || 'user'}</p>
                </div>
              </button>
            ))}
          </div>

          <div className='mt-3 flex items-center justify-end gap-2'>
            <button
              type='button'
              onClick={() => setShareDoc(null)}
              className='rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600'
            >
              Hủy
            </button>
            <button
              type='button'
              disabled={!shareDoc || !shareUserId || shareMutation.isPending}
              onClick={() => {
                if (!shareDoc || !shareUserId) return
                shareMutation.mutate({ userId: shareUserId, documentId: shareDoc.id, title: shareDoc.title })
              }}
              className='rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
            >
              {shareMutation.isPending ? 'Đang gửi...' : 'Gửi chia sẻ'}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[70] transition ${openUpload ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!openUpload}
      >
        <div className='absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]' onClick={() => setOpenUpload(false)} />
        <div className='absolute left-1/2 top-1/2 max-h-[90vh] w-[94vw] max-w-[780px] -translate-x-1/2 -translate-y-1/2 overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5'>
          <div className='mb-4 flex items-start justify-between gap-4'>
            <div>
              <h2 className='text-xl font-extrabold text-slate-800 sm:text-2xl'>Đăng tài liệu mới</h2>
              <p className='mt-1 text-sm text-slate-500'>Hoàn thiện thông tin để tài liệu dễ tìm kiếm hơn.</p>
            </div>
            <button type='button' onClick={() => setOpenUpload(false)} className='grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100' aria-label='Đóng'>
              x
            </button>
          </div>

          <form className='grid min-w-0 gap-3 sm:grid-cols-2' onSubmit={handleUploadSubmit}>
            <div className='sm:col-span-2'>
              <span className='mb-1 block text-sm font-semibold text-slate-700'>File tài liệu</span>
              <label className='grid h-10 w-full min-w-0 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100'>
                <span className='block min-w-0 truncate' title={selectedFileName || 'Chọn file từ máy (pdf, docx, pptx)'}>
                  {shortenedFileName || 'Chọn file từ máy (pdf, docx, pptx)'}
                </span>
                <span className='pointer-events-none inline-flex h-6 flex-shrink-0 items-center whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-700'>
                  Chọn file
                </span>
                <input
                  type='file'
                  accept='.pdf,.doc,.docx,.ppt,.pptx'
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setSelectedFile(file)
                    setSelectedFileName(file?.name ?? '')
                    if (file && !uploadData.title.trim()) {
                      const baseName = file.name.replace(/\.[^.]+$/, '').trim()
                      const normalizedTitle =
                        baseName.length > 80 ? `${baseName.slice(0, 79).trim()}…` : baseName
                      setUploadData((prev) => ({ ...prev, title: normalizedTitle }))
                    }
                    const ext = file?.name.split('.').pop()?.toLowerCase()
                    if (ext === 'pdf') setUploadData((prev) => ({ ...prev, type: 'PDF' }))
                    if (ext === 'doc' || ext === 'docx') setUploadData((prev) => ({ ...prev, type: 'DOC' }))
                    if (ext === 'ppt' || ext === 'pptx') setUploadData((prev) => ({ ...prev, type: 'PPT' }))
                  }}
                />
              </label>
            </div>

            <label className='sm:col-span-2'>
              <span className='mb-1 block text-sm font-semibold text-slate-700'>Tiêu đề</span>
              <input
                value={uploadData.title}
                onChange={(e) => setUploadData((prev) => ({ ...prev, title: e.target.value }))}
                className='h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-300'
                placeholder='VD: Đề cương CSDL cuối kỳ'
              />
            </label>
            {renderUploadSuggestInput({ field: 'subject', label: 'Môn học', placeholder: 'Cơ sở dữ liệu' })}
            {renderUploadSuggestInput({ field: 'major', label: 'Ngành', placeholder: 'CNTT' })}
            {renderUploadSuggestInput({ field: 'school', label: 'Trường', placeholder: 'ĐH Bách Khoa' })}
            {renderUploadSuggestInput({ field: 'cohort', label: 'Khóa', placeholder: 'K23' })}
            <label>
              <span className='mb-1 block text-sm font-semibold text-slate-700'>Loại file</span>
              <input
                value={selectedFile ? uploadData.type : ''}
                readOnly
                className='h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none'
                placeholder='Tự động theo file đã chọn'
              />
            </label>

            <label>
              <span className='mb-1 block text-sm font-semibold text-slate-700'>Tags</span>
              <input
                value={uploadData.tags}
                onChange={(e) => setUploadData((prev) => ({ ...prev, tags: e.target.value }))}
                className='h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-300'
                placeholder='CSDL, SQL, K23'
              />
            </label>

            {uploadError && (
              <div className='sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700'>
                {uploadError}
              </div>
            )}
            {uploadMutation.isError && (
              <div className='sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700'>
                {extractError(uploadMutation.error)}
              </div>
            )}

            <div className='mt-1 flex items-center justify-end gap-2 sm:col-span-2'>
              <button type='button' onClick={() => setOpenUpload(false)} className='rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50'>
                Hủy
              </button>
              <button
                type='submit'
                disabled={uploadMutation.isPending}
                className='rounded-lg border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {uploadMutation.isPending ? 'Đang đăng...' : 'Đăng ngay'}
              </button>
            </div>
          </form>
        </div>
      </div>

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
            <button
              type='button'
              onClick={() => setPreviewDoc(null)}
              className='grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100'
              aria-label='Đóng xem trước'
            >
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
                <iframe
                  title='document-preview'
                  src={previewUrl}
                  className='h-[62vh] w-full rounded-lg border border-slate-200 bg-white'
                />
                )
              ) : (
                <div className='grid h-[62vh] place-items-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-center text-sm font-medium text-amber-800'>
                  {cannotPreviewMessage(previewDoc.type)}
                </div>
              )}
              <p className='mt-2 text-xs font-medium text-slate-500'>{getPreviewHint(previewDoc.type)}</p>
            </div>
          )}

          <div className='mt-3 flex items-center justify-between gap-2'>
            <span className='text-sm text-slate-500'>
              {previewDoc?.type === 'PDF' ? 'Preview trực tiếp trong ứng dụng.' : 'Không hỗ trợ preview trực tiếp với định dạng này.'}
            </span>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={() =>
                  previewDoc && handleDownload(previewDoc.id, previewDoc.title || 'tai-lieu')
                }
                className='rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700'
              >
                Tải xuống
              </button>
              <button
                type='button'
                onClick={handleOpenOriginal}
                className='rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700'
              >
                Mở file gốc
              </button>
              <button
                type='button'
                onClick={() => setPreviewDoc(null)}
                className='rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white'
              >
                Đóng
              </button>
            </div>
          </div>
          {actionError && <p className='mt-3 text-sm font-medium text-rose-600'>{actionError}</p>}
        </div>
      </div>
    </>
  )
}




