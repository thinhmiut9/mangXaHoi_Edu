import { closeDriver, runQuery, verifyConnectivity } from '../config/neo4j'

async function migrateBioToInterests(): Promise<void> {
  await verifyConnectivity()
  const now = new Date().toISOString()

  const [before] = await runQuery<{ total: number; withBio: number; withInterests: number }>(
    `
    MATCH (u:User)
    RETURN
      count(u) AS total,
      count(CASE WHEN coalesce(trim(u.bio), '') <> '' THEN 1 END) AS withBio,
      count(CASE WHEN coalesce(trim(u.interests), '') <> '' THEN 1 END) AS withInterests
    `
  )

  console.log('Before migration:', before)

  const [result] = await runQuery<{ updated: number }>(
    `
    MATCH (u:User)
    SET u.interests =
      CASE
        WHEN coalesce(trim(u.interests), '') <> '' THEN trim(u.interests)
        WHEN coalesce(trim(u.bio), '') <> '' THEN trim(u.bio)
        WHEN coalesce(trim(u.major), '') <> '' AND coalesce(trim(u.school), '') <> ''
          THEN 'Quan tam ' + trim(u.major) + ' va hoc tap tai ' + trim(u.school)
        WHEN coalesce(trim(u.major), '') <> ''
          THEN 'Quan tam hoc tap va trao doi ve ' + trim(u.major)
        WHEN coalesce(trim(u.school), '') <> ''
          THEN 'Muon ket noi va hoc hoi cung sinh vien tai ' + trim(u.school)
        WHEN coalesce(trim(u.location), '') <> ''
          THEN 'Muon tham gia cong dong hoc tap tai ' + trim(u.location)
        ELSE 'Quan tam hoc tap, chia se tai lieu va ket noi ban be'
      END,
      u.updatedAt = $now
    REMOVE u.bio
    RETURN count(u) AS updated
    `,
    { now }
  )

  console.log('Migration result:', result)

  const [after] = await runQuery<{ total: number; withInterests: number; withBio: number }>(
    `
    MATCH (u:User)
    RETURN
      count(u) AS total,
      count(CASE WHEN coalesce(trim(u.interests), '') <> '' THEN 1 END) AS withInterests,
      count(CASE WHEN u.bio IS NOT NULL AND coalesce(trim(u.bio), '') <> '' THEN 1 END) AS withBio
    `
  )

  console.log('After migration:', after)
}

migrateBioToInterests()
  .catch((error) => {
    console.error('Failed to migrate bio to interests:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDriver()
  })
