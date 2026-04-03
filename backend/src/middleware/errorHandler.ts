import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { sendError } from '../utils/response'
import { env } from '../config/env'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code?: string,
    public errors?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {}
    err.errors.forEach(e => {
      const key = e.path.join('.')
      errors[key] = errors[key] ? [...errors[key], e.message] : [e.message]
    })
    sendError(res, 'Validation failed', 422, errors, 'VALIDATION_ERROR')
    return
  }

  // Known application error
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors, err.code)
    return
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token', 401, undefined, 'INVALID_TOKEN')
    return
  }
  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired', 401, undefined, 'TOKEN_EXPIRED')
    return
  }

  // Unknown error
  console.error('Unhandled error:', err)
  const message = env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  sendError(res, message, 500, undefined, 'INTERNAL_ERROR')
}

export function notFoundHandler(_req: Request, res: Response): void {
  sendError(res, 'Route not found', 404, undefined, 'NOT_FOUND')
}
