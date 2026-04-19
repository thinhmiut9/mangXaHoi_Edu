import neo4j, { Driver, Session } from 'neo4j-driver'
import { env } from './env'

let driver: Driver | null = null

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      env.NEO4J_URI,
      neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD),
      {
        maxConnectionPoolSize: 50,
        // Keep acquisition timeout >= connectionTimeout to avoid neo4j-driver warning
        connectionAcquisitionTimeout: 30000,
        logging: neo4j.logging.console(env.NODE_ENV === 'development' ? 'warn' : 'error'),
      }
    )
  }
  return driver
}

export function getSession(): Session {
  return getDriver().session()
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close()
    driver = null
  }
}

export async function verifyConnectivity(): Promise<void> {
  const d = getDriver()
  await d.verifyConnectivity()
  console.log('✅ Neo4j connected:', env.NEO4J_URI)
}

/**
 * Helper: run a single Cypher query and return records
 */
export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = getSession()
  try {
    const result = await session.run(cypher, params)
    return result.records.map(r => r.toObject() as T)
  } finally {
    await session.close()
  }
}

/**
 * Helper: run query and return first record or null
 */
export async function runQueryOne<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const results = await runQuery<T>(cypher, params)
  return results[0] ?? null
}
