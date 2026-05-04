import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { createHash } from 'crypto'
import { paginationMeta } from '../../utils/response'
import { uploadRawToCloudinary } from '../uploads/uploads.utils'
import { AppError } from '../../middleware/errorHandler'
import { CreateDocumentDto, ListDocumentsQueryDto } from './documents.schema'
import { documentsRepository, type DocumentRow } from './documents.repository'
import { buildSignedRawAccessUrl, deleteCloudinaryAsset } from '../../utils/cloudinary'

function sanitizeBaseFileName(name: string): string {
  const ext = (path.extname(name || '') || '').toLowerCase()
  return (
    path
      .basename(name || 'document', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120) || 'document'
  )
}

function normalizeFileTypeByExt(fileName: string): 'PDF' | 'DOC' | 'PPT' {
  const ext = (path.extname(fileName || '') || '').toLowerCase()
  if (ext === '.pdf') return 'PDF'
  if (ext === '.doc' || ext === '.docx') return 'DOC'
  if (ext === '.ppt' || ext === '.pptx') return 'PPT'
  throw new AppError('Chi chap nhan file pdf, doc/docx, ppt/pptx', 400, 'UNSUPPORTED_DOCUMENT_TYPE')
}

function getMimeType(fileName: string, fileType: 'PDF' | 'DOC' | 'PPT'): string {
  const ext = (path.extname(fileName || '') || '').toLowerCase()
  if (ext === '.pdf' || fileType === 'PDF') return 'application/pdf'
  if (ext === '.doc') return 'application/msword'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.ppt') return 'application/vnd.ms-powerpoint'
  if (ext === '.pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  return 'application/octet-stream'
}

function buildDuplicateDocumentError(document: DocumentRow | null | undefined): AppError {
  const existingTitle = document?.title?.trim() || document?.fileName?.trim() || 'tai lieu khac'
  return new AppError(
    `Tai lieu nay da ton tai trong he thong (${existingTitle}).`,
    409,
    'DOCUMENT_DUPLICATE',
    document
      ? {
          documentId: [document.documentId],
          title: [existingTitle],
          status: [document.status],
          uploaderId: [document.uploaderId],
        }
      : undefined
  )
}

function isFileHashConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const candidate = err as { code?: string; message?: string }
  return (
    candidate.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' &&
    !!(candidate.message?.includes('document_fileHash') || candidate.message?.includes('fileHash'))
  )
}

export const documentsService = {
  async create(userId: string, dto: CreateDocumentDto, file: Express.Multer.File | undefined) {
    if (!file) throw new AppError('Khong co file duoc tai len', 400, 'DOCUMENT_FILE_REQUIRED')

    const fileHash = createHash('sha256').update(file.buffer).digest('hex')
    const duplicatedDocument = await documentsRepository.findByFileHash(fileHash)
    if (duplicatedDocument) {
      throw buildDuplicateDocumentError(duplicatedDocument)
    }

    const ext = (path.extname(file.originalname || '') || '').toLowerCase()
    const base = sanitizeBaseFileName(file.originalname || 'document')
    const publicId = `${base}_${Date.now()}${ext}`
    const uploaded = await uploadRawToCloudinary(file.buffer, 'documents', publicId, file.originalname)

    const now = new Date().toISOString()
    try {
      const saved = await documentsRepository.create({
        documentId: uuidv4(),
        title: dto.title?.trim() || base,
        fileName: file.originalname,
        fileUrl: uploaded.url,
        fileHash,
        uploadSourceName: file.originalname,
        duplicateOf: null,
        fileType: normalizeFileTypeByExt(file.originalname),
        subject: dto.subject,
        school: dto.school,
        major: dto.major,
        cohort: dto.cohort,
        description: dto.description,
        tags: dto.tags,
        visibility: dto.visibility ?? 'PUBLIC',
        uploaderId: userId,
        createdAt: now,
        updatedAt: now,
      })

      return saved
    } catch (err) {
      await deleteCloudinaryAsset(uploaded.url).catch(() => {})
      if (isFileHashConstraintError(err)) {
        const duplicatedAfterCreate = await documentsRepository.findByFileHash(fileHash)
        throw buildDuplicateDocumentError(duplicatedAfterCreate)
      }
      throw err
    }
  },

  async list(userId: string, query: ListDocumentsQueryDto) {
    const { rows, total } = await documentsRepository.list(userId, query)
    return {
      documents: rows,
      meta: paginationMeta(query.page, query.limit, total),
    }
  },

  async getSaved(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const { rows, total } = await documentsRepository.getSavedDocuments(userId, skip, limit)
    return {
      documents: rows,
      meta: paginationMeta(page, limit, total),
    }
  },

  async getMine(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const { rows, total } = await documentsRepository.getUploadedDocuments(userId, skip, limit)
    return {
      documents: rows,
      meta: paginationMeta(page, limit, total),
    }
  },

  async getAccessible(userId: string, documentId: string) {
    const document = await documentsRepository.findAccessibleById(userId, documentId)
    if (!document) throw new AppError('Khong tim thay tai lieu', 404, 'DOCUMENT_NOT_FOUND')
    return document
  },

  async fetchFileBuffer(userId: string, documentId: string) {
    const document = await this.getAccessible(userId, documentId)
    const response = await fetch(document.fileUrl, { method: 'GET' })
    if (!response.ok) {
      throw new AppError('Khong the tai noi dung tai lieu', 502, 'DOCUMENT_FETCH_FAILED')
    }
    const arrayBuffer = await response.arrayBuffer()

    return {
      document,
      buffer: Buffer.from(arrayBuffer),
      contentType: getMimeType(document.fileName, document.fileType),
    }
  },

  async getAccessUrl(userId: string, documentId: string, asAttachment = false) {
    const document = await this.getAccessible(userId, documentId)
    const signedUrl = buildSignedRawAccessUrl(document.fileUrl, asAttachment)
    if (!signedUrl) throw new AppError('Khong tao duoc lien ket truy cap tai lieu', 500, 'DOCUMENT_URL_FAILED')

    return {
      document,
      url: signedUrl,
    }
  },

  async recordView(userId: string, documentId: string) {
    const document = await documentsRepository.incrementViews(userId, documentId)
    if (!document) throw new AppError('Khong tim thay tai lieu', 404, 'DOCUMENT_NOT_FOUND')
    return document
  },

  async recordDownload(userId: string, documentId: string) {
    const document = await documentsRepository.incrementDownloads(userId, documentId)
    if (!document) throw new AppError('Khong tim thay tai lieu', 404, 'DOCUMENT_NOT_FOUND')
    return document
  },

  async toggleSave(userId: string, documentId: string) {
    await this.getAccessible(userId, documentId)
    return documentsRepository.toggleSave(documentId, userId)
  },

  async deleteOwn(userId: string, documentId: string) {
    const document = await documentsRepository.findOwnedById(userId, documentId)
    if (!document) throw new AppError('Khong tim thay tai lieu', 404, 'DOCUMENT_NOT_FOUND')

    if (document.fileUrl) {
      await deleteCloudinaryAsset(document.fileUrl)
    }

    await documentsRepository.delete(documentId)
  },

  async deleteAsAdmin(documentId: string) {
    const document = await documentsRepository.findById(documentId)
    if (!document) throw new AppError('Khong tim thay tai lieu', 404, 'DOCUMENT_NOT_FOUND')

    if (document.fileUrl) {
      await deleteCloudinaryAsset(document.fileUrl)
    }

    await documentsRepository.delete(documentId)
  },
}
