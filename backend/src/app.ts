import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './config/env'
import { generalLimiter } from './middleware/rateLimiter'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'

// Route imports
import authRoutes from './modules/auth/auth.routes'
import userRoutes from './modules/users/users.routes'
import postRoutes from './modules/posts/posts.routes'
import commentRoutes from './modules/comments/comments.routes'
import friendRoutes from './modules/friends/friends.routes'
import groupRoutes from './modules/groups/groups.routes'
import chatRoutes from './modules/chat/chat.routes'
import notificationRoutes from './modules/notifications/notifications.routes'
import reportRoutes from './modules/reports/reports.routes'
import adminRoutes from './modules/admin/admin.routes'
import uploadRoutes from './modules/uploads/uploads.routes'
import storyRoutes from './modules/stories/stories.routes'

const app = express()

// Security headers
app.use(helmet())

// CORS
const allowedOrigins = new Set([env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174'])

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients and same-origin requests with no Origin header.
    if (!origin) return callback(null, true)
    if (allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Request logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Global rate limiter
app.use('/api', generalLimiter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'EduSocial API is running',
    data: {
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/stories', storyRoutes)

// 404 handler
app.use(notFoundHandler)

// Global error handler (must be last)
app.use(errorHandler)

export default app
