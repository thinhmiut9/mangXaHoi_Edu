import { z } from 'zod'

const emailSchema = z.string().trim().toLowerCase().email('Email khong hop le')

export const registerSchema = z.object({
  email: emailSchema,
  displayName: z.string().min(2, 'Ten hien thi toi thieu 2 ky tu').max(50),
  password: z
    .string()
    .min(8, 'Mat khau toi thieu 8 ky tu')
    .regex(/[A-Z]/, 'Mat khau phai co it nhat 1 chu hoa')
    .regex(/[0-9]/, 'Mat khau phai co it nhat 1 chu so'),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mat khau khong duoc trong'),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token khong hop le'),
  password: z
    .string()
    .min(8, 'Mat khau toi thieu 8 ky tu')
    .regex(/[A-Z]/, 'Mat khau phai co it nhat 1 chu hoa')
    .regex(/[0-9]/, 'Mat khau phai co it nhat 1 chu so'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mat khau hien tai khong duoc trong'),
  newPassword: z
    .string()
    .min(8, 'Mat khau moi toi thieu 8 ky tu')
    .regex(/[A-Z]/, 'Mat khau moi phai co it nhat 1 chu hoa')
    .regex(/[0-9]/, 'Mat khau moi phai co it nhat 1 chu so'),
})

export type RegisterDto = z.infer<typeof registerSchema>
export type LoginDto = z.infer<typeof loginSchema>
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>
