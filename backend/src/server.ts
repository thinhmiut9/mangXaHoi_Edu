import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import app from './app'
import { env } from './config/env'
import { verifyConnectivity, closeDriver } from './config/neo4j'
import { setupSocket } from './socket'
import { loadRecommendationsCache } from './modules/documents/documents.recommendations'

async function bootstrap() {
  // Verify DB connection
  try {
    await verifyConnectivity()
  } catch (err) {
    console.error('❌ Failed to connect to Neo4j:', err)
    process.exit(1)
  }

  // Load pre-trained recommendations cache (non-blocking)
  loadRecommendationsCache().catch(err =>
    console.warn('[Recommendations] Cache load failed (non-fatal):', err)
  )

  // Create HTTP server
  const httpServer = createServer(app)

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  setupSocket(io)

  // Start listening
  httpServer.listen(env.PORT, env.HOST, () => {
    console.log(`🚀 EduSocial API running at ${env.APP_URL}`)
    console.log(`🔌 Socket.IO ready`)
    console.log(`🌿 Environment: ${env.NODE_ENV}`)
    console.log(`❤️  Health: ${env.APP_URL}/api/health`)
  })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`)
    httpServer.close(async () => {
      await closeDriver()
      console.log('✅ Server closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

bootstrap().catch(err => {
  console.error('Bootstrap failed:', err)
  process.exit(1)
})
