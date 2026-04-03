import rateLimit from 'express-rate-limit'
import { sendError } from '../utils/response'
import { env } from '../config/env'

const isDevelopment = env.NODE_ENV === 'development'

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  skip: () => isDevelopment,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many requests, please try again later', 429, undefined, 'RATE_LIMIT_EXCEEDED')
  },
})

// Strict limiter for auth endpoints (prevent brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  skip: () => isDevelopment,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    sendError(
      res,
      'Too many failed attempts. Please try again in 15 minutes.',
      429,
      undefined,
      'AUTH_RATE_LIMIT'
    )
  },
})

// Upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  skip: () => isDevelopment,
  handler: (_req, res) => {
    sendError(res, 'Too many upload requests', 429, undefined, 'UPLOAD_RATE_LIMIT')
  },
})
