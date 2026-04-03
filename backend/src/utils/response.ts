// Unified API response types
export interface ApiSuccess<T = unknown> {
  success: true
  message: string
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  success: false
  message: string
  errors?: Record<string, string[]>
  code?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

import { Response } from 'express'

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta
): Response {
  const body: ApiSuccess<T> = { success: true, message, data }
  if (meta) body.meta = meta
  return res.status(statusCode).json(body)
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string[]>,
  code?: string
): Response {
  const body: ApiError = { success: false, message }
  if (errors) body.errors = errors
  if (code) body.code = code
  return res.status(statusCode).json(body)
}

export function paginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit)
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}
