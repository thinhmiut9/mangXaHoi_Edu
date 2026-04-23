import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { authRepository } from './auth.repository'
import { AppError } from '../../middleware/errorHandler'
import { env } from '../../config/env'
import { sendMail, resetPasswordTemplate, welcomeTemplate } from '../../utils/email'
import { JwtPayload } from '../../middleware/requireAuth'
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './auth.schema'
import { User, UserPublic } from '../../types'
import { usersRepository } from '../users/users.repository'

const SALT_ROUNDS = 12

function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

function sanitizeUser(user: User): UserPublic {
  const { passwordHash: _passwordHash, updatedAt: _updatedAt, ...safe } = user
  return safe
}

export const authService = {
  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase()
    const existingEmail = await authRepository.findByEmail(normalizedEmail)

    if (existingEmail) {
      throw new AppError('Email da duoc su dung', 409, 'EMAIL_TAKEN')
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)
    const created = await authRepository.create({
      userId: uuidv4(),
      email: normalizedEmail,
      displayName: dto.displayName,
      passwordHash,
    })

    sendMail({
      to: created.email,
      subject: 'Chao mung den EduSocial!',
      html: welcomeTemplate(created.displayName),
    }).catch(err => console.error('Welcome email failed:', err))

    const token = generateToken({
      userId: created.userId,
      email: created.email,
      role: created.role,
    })

    return { user: created, token }
  },

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase()
    const user = await authRepository.findByEmail(normalizedEmail)
    if (!user) {
      throw new AppError('Email hoac mat khau khong dung', 401, 'INVALID_CREDENTIALS')
    }
    if (user.status === 'BLOCKED') {
      const blockedUntilRaw = (user as User & { blockedUntil?: string }).blockedUntil
      const blockedUntil = blockedUntilRaw ? new Date(blockedUntilRaw) : null
      if (blockedUntil && !Number.isNaN(blockedUntil.getTime()) && blockedUntil.getTime() <= Date.now()) {
        await usersRepository.updateStatus(user.userId, 'ACTIVE')
        user.status = 'ACTIVE'
      } else {
        const suffix = blockedUntil ? ` den ${blockedUntil.toLocaleString('vi-VN')}` : ''
        throw new AppError(`Tai khoan cua ban da bi khoa${suffix}`, 403, 'ACCOUNT_BLOCKED')
      }
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!isPasswordValid) {
      throw new AppError('Email hoac mat khau khong dung', 401, 'INVALID_CREDENTIALS')
    }

    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    })

    return { user: sanitizeUser(user), token }
  },

  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = dto.email.trim().toLowerCase()
    const user = await authRepository.findByEmail(normalizedEmail)
    if (!user) return

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await authRepository.saveResetToken(user.userId, token, expiresAt)

    const resetUrl = `${env.RESET_PASSWORD_URL}?token=${token}`
    await sendMail({
      to: user.email,
      subject: 'Dat lai mat khau EduSocial',
      html: resetPasswordTemplate(user.displayName, resetUrl),
    })
  },

  async resetPassword(dto: ResetPasswordDto) {
    const user = await authRepository.findByResetToken(dto.token)
    if (!user) {
      throw new AppError('Lien ket dat lai mat khau khong hop le hoac da het han', 400, 'INVALID_RESET_TOKEN')
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)
    await authRepository.updatePassword(user.userId, passwordHash)
  },

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await authRepository.findByIdForAuth(userId)
    if (!user) {
      throw new AppError('Nguoi dung khong tim thay', 404, 'USER_NOT_FOUND')
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash)
    if (!isCurrentPasswordValid) {
      throw new AppError('Mat khau hien tai khong dung', 400, 'INVALID_CURRENT_PASSWORD')
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash)
    if (isSamePassword) {
      throw new AppError('Mat khau moi phai khac mat khau hien tai', 400, 'PASSWORD_NOT_CHANGED')
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS)
    await authRepository.updatePassword(user.userId, newPasswordHash)
  },

  async getMe(userId: string) {
    const user = await authRepository.findById(userId)
    if (!user) {
      throw new AppError('Nguoi dung khong tim thay', 404, 'USER_NOT_FOUND')
    }
    return user
  },
}
