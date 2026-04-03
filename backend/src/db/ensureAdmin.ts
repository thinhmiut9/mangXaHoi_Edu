import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { runQueryOne } from '../config/neo4j'
import { verifyConnectivity, closeDriver } from '../config/neo4j'

const DEFAULT_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@edusocial.app'
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123'
const DEFAULT_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME ?? 'System Admin'
const SALT_ROUNDS = 12

async function ensureAdmin(): Promise<void> {
  await verifyConnectivity()

  const now = new Date().toISOString()
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS)

  const result = await runQueryOne<{ email: string; userId: string }>(
    `MERGE (u:User {email: $email})
     ON CREATE SET
       u.userId = $userId,
       u.displayName = $displayName,
       u.role = 'ADMIN',
       u.status = 'ACTIVE',
       u.profileVisibility = 'PUBLIC',
       u.createdAt = $now,
       u.updatedAt = $now,
       u.lastOnlineAt = $now
     SET
       u.passwordHash = $passwordHash,
       u.role = 'ADMIN',
       u.status = 'ACTIVE',
       u.updatedAt = $now
     RETURN u.email AS email, u.userId AS userId`,
    {
      email: DEFAULT_EMAIL.trim().toLowerCase(),
      userId: uuidv4(),
      displayName: DEFAULT_DISPLAY_NAME,
      passwordHash,
      now,
    }
  )

  console.log('Admin account is ready:')
  console.log(`  email: ${result?.email ?? DEFAULT_EMAIL}`)
  console.log(`  password: ${DEFAULT_PASSWORD}`)
}

ensureAdmin()
  .then(async () => {
    await closeDriver()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Failed to ensure admin account:', err)
    await closeDriver()
    process.exit(1)
  })

