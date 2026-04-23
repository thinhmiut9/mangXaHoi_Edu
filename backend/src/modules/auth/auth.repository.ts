import { runQuery, runQueryOne } from '../../config/neo4j'
import { User, UserPublic } from '../../types'

export interface CreateUserData {
  userId: string
  email: string
  displayName: string
  passwordHash: string
}

export const authRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {email: $email}) RETURN u`,
      { email }
    )
    if (!result) return null
    return result.u.properties
  },

  async findById(userId: string): Promise<UserPublic | null> {
    const result = await runQueryOne<{ u: { properties: UserPublic } }>(
      `MATCH (u:User {userId: $userId}) RETURN u`,
      { userId }
    )
    if (!result) return null
    return result.u.properties
  },

  async findByIdForAuth(userId: string): Promise<User | null> {
    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {userId: $userId}) RETURN u`,
      { userId }
    )
    if (!result) return null
    return result.u.properties
  },

  async create(data: CreateUserData): Promise<UserPublic> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ u: { properties: UserPublic } }>(
      `CREATE (u:User {
        userId: $userId,
        email: $email,
        displayName: $displayName,
        passwordHash: $passwordHash,
        role: 'USER',
        status: 'ACTIVE',
        profileVisibility: 'PUBLIC',
        createdAt: $now,
        updatedAt: $now,
        lastOnlineAt: $now
      }) RETURN u`,
      { ...data, now }
    )
    return result!.u.properties
  },

  async saveResetToken(userId: string, token: string, expiresAt: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})
       SET u.resetToken = $token, u.resetTokenExpiresAt = $expiresAt`,
      { userId, token, expiresAt }
    )
  },

  async findByResetToken(token: string): Promise<User | null> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {resetToken: $token})
       WHERE u.resetTokenExpiresAt > $now
       RETURN u`,
      { token, now }
    )
    if (!result) return null
    return result.u.properties
  },

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (u:User {userId: $userId})
       SET u.passwordHash = $passwordHash,
           u.resetToken = null,
           u.resetTokenExpiresAt = null,
           u.updatedAt = $now`,
      { userId, passwordHash, now }
    )
  },

  async updateLastOnline(userId: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (u:User {userId: $userId}) SET u.lastOnlineAt = $now`,
      { userId, now }
    )
  },
}
