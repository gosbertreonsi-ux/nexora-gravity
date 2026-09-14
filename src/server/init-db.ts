import pg from 'pg';
const { Client, Pool } = pg;

const dbPassword = "1971"; // Update with your actual database password

async function runProvisioning() {
  console.log("🚀 Initializing updated master schema cluster...");
  
  const pool = new Pool({
    connectionString: `postgresql://postgres:${dbPassword}@localhost:5432/nexora_gravity?schema=public`
  });

  // 1. Re-build EnterpriseClient to include corporate credentials
  console.log("🗄️ Constructing secure corporate registry schema...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "EnterpriseClient" (
      id UUID PRIMARY KEY,
      "companyName" TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      "apiKey" TEXT UNIQUE NOT NULL,
      "balanceCents" BIGINT DEFAULT 500000,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 2. Ensure ValidationLog references the client schema safely
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ValidationLog" (
      id UUID PRIMARY KEY,
      "enterpriseClientId" UUID REFERENCES "EnterpriseClient"(id),
      "deviceFingerprint" TEXT NOT NULL,
      "isHuman" BOOLEAN NOT NULL,
      "chaosHash" TEXT NOT NULL,
      "revenueGenerated" DOUBLE PRECISION DEFAULT 0.00001,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  console.log("✅ Multi-user enterprise tables initialized successfully!");
  await pool.end();
  process.exit(0);
}

runProvisioning().catch(err => {
  console.error("❌ Provisioning Error:", err.message);
  process.exit(1);
});
