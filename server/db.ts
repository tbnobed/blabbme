import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Check if we're using Neon (for Replit) or standard PostgreSQL (for Docker)
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech') || 
                      process.env.DATABASE_URL.includes('.pooler.supabase.com') ||
                      !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('postgres:5432');

let pool: any;
let db: any;

if (isNeonDatabase) {
  // Use Neon serverless for Replit
  const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle: drizzleNeon } = await import('drizzle-orm/neon-serverless');
  const ws = await import('ws');
  
  neonConfig.webSocketConstructor = ws.default;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema });
} else {
  // Use standard PostgreSQL for Docker/local
  const { Pool: PgPool } = await import('pg');
  const { drizzle: drizzlePg } = await import('drizzle-orm/node-postgres');
  
  pool = new PgPool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  db = drizzlePg(pool, { schema });
}

export { pool, db };
