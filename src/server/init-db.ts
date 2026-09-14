import pg from 'pg';
const { Client, Pool } = pg;

const dbPassword = "1971"; // Update this with your actual database password

async function runProvisioning() {
  console.log("🚀 Initializing master connection cluster setup...");
  
  // 1. Establish initial fallback handle connection to the root postgres system cluster
  const rootClient = new Client({
    connectionString: `postgresql://postgres:${dbPassword}@localhost:5432/postgres`
  });
  
  await rootClient.connect();
  
  // 2. Safely verify and generate the physical nexora_gravity database grid container
  console.log("🐳 Generating database structural container...");
  try {
    await rootClient.query('CREATE DATABASE nexora_gravity;');
    console.log("🔹 Database container generated.");
  } catch (err: any) {
    if (err.code === '42P04') {
      console.log("🔹 Database container already exists.");
    } else {
      console.error("❌ Fatal Container Creation Error:", err.message);
    }
  }
  await rootClient.end();

  // 3. Connect to our freshly minted nexora_gravity instance to build tables
  console.log("🗄️ Initializing tables setup inside nexora_gravity instance...");
  const pool = new Pool({
    connectionString: `postgresql://postgres:${dbPassword}@localhost:5432/nexora_gravity?schema=public`
  });

  // 4. Create structural multi-tenant table footprints
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "EnterpriseClient" (
      id UUID PRIMARY KEY,
      "companyName" TEXT NOT NULL,
      "apiKey" TEXT UNIQUE NOT NULL,
      "balanceCents" BIGINT DEFAULT 0
    );
  `);

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

  // 5. Seed your active mock enterprise profile client 
  await pool.query(`
    INSERT INTO "EnterpriseClient" (id, "companyName", "apiKey", "balanceCents")
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Global Apex Bank', 'test_bank_key_123', 500000)
    ON CONFLICT ("apiKey") DO NOTHING;
  `);

  console.log("✅ Database infrastructure layers established and pre-funded successfully!");
  await pool.end();
  process.exit(0);
}

runProvisioning().catch(err => {
  console.error("❌ Runtime Provisioning Crash Error:", err.message);
  process.exit(1);
});
