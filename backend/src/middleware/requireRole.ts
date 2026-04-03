import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response'
import { JwtPayload } from './requireAuth'

type Role = JwtPayload['role']

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, undefined, 'UNAUTHORIZED')
      return
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403, undefined, 'FORBIDDEN')
      return
    }
    next()
  }
}
