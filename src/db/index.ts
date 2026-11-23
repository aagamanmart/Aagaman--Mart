import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const isDbConfigured = Boolean(process.env.SQL_HOST && process.env.SQL_DB_NAME);

export const createPool = () => {
  if (!isDbConfigured) {
    return undefined;
  }
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

function createMockDb(): NodePgDatabase<typeof schema> {
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d?: { data?: unknown }) => d?.data ?? {},
    update: async (d?: { data?: unknown }) => d?.data ?? {},
    delete: async () => ({}),
  };
  return new Proxy({} as NodePgDatabase<typeof schema>, {
    get: (_target, prop) =>
      prop === 'query'
        ? new Proxy({}, { get: () => noOp })
        : async () => [],
  });
}

let db: NodePgDatabase<typeof schema>;
try {
  const pool = createPool();
  if (!pool) {
    throw new Error('SQL_HOST / SQL_DB_NAME not configured');
  }
  db = drizzle(pool, { schema });
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  db = createMockDb();
}

export { db };
