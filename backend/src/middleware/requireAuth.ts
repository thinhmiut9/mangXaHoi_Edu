import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { sendError } from '../utils/response'
import { runQuery, runQueryOne } from '../config/neo4j'

export interface JwtPayload {
  userId: string
  email: string
  role: 'USER' | 'ADMIN'
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401, undefined, 'UNAUTHORIZED')
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    const account = await runQueryOne<{ status?: string; blockedUntil?: string | null }>(
      `MATCH (u:User {userId: $userId})
       RETURN coalesce(u.status, 'ACTIVE') AS status, toString(u.blockedUntil) AS blockedUntil`,
      { userId: payload.userId }
    )
    if (account?.status === 'BLOCKED') {
      const blockedUntil = account.blockedUntil ? new Date(account.blockedUntil) : null
      if (blockedUntil && !Number.isNaN(blockedUntil.getTime()) && blockedUntil.getTime() <= Date.now()) {
        await runQuery(
          `MATCH (u:User {userId: $userId})
           SET u.status = 'ACTIVE', u.blockedUntil = null, u.updatedAt = $now`,
          { userId: payload.userId, now: new Date().toISOString() }
        )
      } else {
        sendError(res, 'Tai khoan cua ban da bi khoa', 403, undefined, 'ACCOUNT_BLOCKED')
        return
      }
    }
    req.user = payload
    next()
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      sendError(res, 'Token expired', 401, undefined, 'TOKEN_EXPIRED')
    } else {
      sendError(res, 'Invalid token', 401, undefined, 'INVALID_TOKEN')
    }
  }
}
