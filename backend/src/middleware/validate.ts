import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { sendError } from '../utils/response'

type Target = 'body' | 'query' | 'params'

export function validate(schema: ZodSchema, target: Target = 'body') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req[target])
      req[target] = parsed
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string[]> = {}
        err.errors.forEach(e => {
          const key = e.path.join('.') || 'value'
          errors[key] = errors[key] ? [...errors[key], e.message] : [e.message]
        })
        sendError(res, 'Validation failed', 422, errors, 'VALIDATION_ERROR')
      } else {
        next(err)
      }
    }
  }
}
