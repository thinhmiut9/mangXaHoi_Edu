import { Router } from 'express'
import { authController } from './auth.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { validate } from '../../middleware/validate'
import { authLimiter } from '../../middleware/rateLimiter'
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema'

const router = Router()

// Public routes (with strict rate limiting)
router.post('/register', authLimiter, validate(registerSchema), authController.register)
router.post('/login', authLimiter, validate(loginSchema), authController.login)
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword)
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword)

// Protected routes
router.get('/me', requireAuth, authController.me)
router.post('/logout', requireAuth, authController.logout)
router.post('/change-password', authLimiter, requireAuth, validate(changePasswordSchema), authController.changePassword)

export default router
