import { z } from 'zod'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Backward compatibility: some setups use NEO4J_USERNAME instead of NEO4J_USER.
if (!process.env.NEO4J_USER && process.env.NEO4J_USERNAME) {
  process.env.NEO4J_USER = process.env.NEO4J_USERNAME
}

const envSchema = z.object({
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(5001),
  APP_URL: z.string().url().default('http://localhost:5001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  NEO4J_URI: z.string().min(1, 'NEO4J_URI is required'),
  NEO4J_USER: z.string().min(1, 'NEO4J_USER is required'),
  NEO4J_PASSWORD: z.string().min(1, 'NEO4J_PASSWORD is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),

  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().transform(v => v === 'true').default('false'),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  MAIL_FROM: z.string().default('EduSocial <no-reply@edusocial.app>'),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CLIENT_URLS: z.string().optional().default(''),
  RESET_PASSWORD_URL: z.string().url().default('http://localhost:5173/reset-password'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
