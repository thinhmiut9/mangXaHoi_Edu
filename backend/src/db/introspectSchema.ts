import { runQuery, verifyConnectivity, closeDriver } from '../config/neo4j'

type Row = Record<string, unknown>

async function main(): Promise<void> {
  await verifyConnectivity()

  const labels = await runQuery<Row>(`
    MATCH (n)
    UNWIND labels(n) AS label
    RETURN label, count(*) AS nodeCount
    ORDER BY label
  `)

  const nodeProps = await runQuery<Row>(`
    MATCH (n)
    UNWIND labels(n) AS label
    UNWIND keys(n) AS prop
    RETURN label, prop, count(*) AS occurrences
    ORDER BY label, prop
  `)

  const relTypes = await runQuery<Row>(`
    MATCH ()-[r]->()
    RETURN type(r) AS relType, count(*) AS relCount
    ORDER BY relType
  `)

  const relProps = await runQuery<Row>(`
    MATCH ()-[r]->()
    WITH type(r) AS relType, r
    UNWIND keys(r) AS prop
    RETURN relType, prop, count(*) AS occurrences
    ORDER BY relType, prop
  `)

  let constraints: Row[] = []
  let indexes: Row[] = []
  try {
    constraints = await runQuery<Row>(`SHOW CONSTRAINTS`)
  } catch {
    constraints = []
  }

  try {
    indexes = await runQuery<Row>(`SHOW INDEXES`)
  } catch {
    indexes = []
  }

  const output = {
    generatedAt: new Date().toISOString(),
    labels,
    nodeProps,
    relTypes,
    relProps,
    constraints,
    indexes,
  }

  console.log(JSON.stringify(output, null, 2))
  await closeDriver()
}

main().catch(async (err) => {
  console.error('INTROSPECT_FAILED', err)
  await closeDriver()
  process.exit(1)
})
