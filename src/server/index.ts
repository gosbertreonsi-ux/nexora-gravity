import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import pg from 'pg';
import Stripe from 'stripe';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ChaosEngine } from '../crypto/chaosEngine';
import { AIPredicativeWorker } from '../ai/predictiveWorker';
import { MonitorAgent } from '../telemetry/monitorAgent';

const { Pool } = pg;
const fastify = Fastify({ logger: true });

// ENABLES CROSS-ORIGIN NETWORK ACCESS FOR THE NEXT.JS DASHBOARD
fastify.register(fastifyCors, { origin: "*", methods: ["GET", "POST"] });
fastify.register(fastifyWebsocket);

// ADAPTIVE DATABASE STRING: Uses the live cloud URL variable on Railway, fallbacks locally
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/nexora_gravity?schema=public"
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_secret_key_123', { apiVersion: '2023-10-16' as any });
const MASTER_SECRET = process.env.MASTER_SECRET || "nexora_absolute_entropy_shield_2026";
const JWT_SECRET = process.env.JWT_SECRET || "nexora_jwt_token_encryption_shield_2026";
const BLACKLISTED_DEVICES = new Set<string>(); 

interface TelemetryPayload {
  apiKey?: string;
  action?: string;
  deviceFingerprint: string;
  gyroWobble?: number;
  lightFrequency?: number;
  clockDrift?: number;
  token?: string;
}

function broadcastToDashboards(data: any) {
  // @ts-ignore
  if (fastify.websocketServer && fastify.websocketServer.clients) {
    // @ts-ignore
    fastify.websocketServer.clients.forEach((client: any) => {
      if (client.readyState === 1) client.send(JSON.stringify(data));
    });
  }
}

// ─── AUTH ROUTE 1: ENTERPRISE SIGNUP & API KEY GENERATION ───
fastify.post('/v1/auth/signup', async (request, reply) => {
  const { companyName, email, password } = request.body as any;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const generatedApiKey = 'nxr_live_' + crypto.randomBytes(24).toString('hex');
    const clientId = crypto.randomUUID();

    await pool.query(
      'INSERT INTO "EnterpriseClient" (id, "companyName", email, password, "apiKey") VALUES ($1, $2, $3, $4, $5)',
      [clientId, companyName, email, hashedPassword, generatedApiKey]
    );

    const token = jwt.sign({ clientId, email }, JWT_SECRET, { expiresIn: '7d' });
    return reply.status(201).send({ status: "SUCCESS", token, apiKey: generatedApiKey, companyName });
  } catch (err: any) {
    fastify.log.error("Signup error caught: ", err.message);
    return reply.status(400).send({ status: "ERROR", message: "Email registration collision or payload fault." });
  }
});

// ─── AUTH ROUTE 2: ENTERPRISE PORTAL LOGIN ───
fastify.post('/v1/auth/login', async (request, reply) => {
  const { email, password } = request.body as any;
  try {
    const userQuery = await pool.query('SELECT * FROM "EnterpriseClient" WHERE email = $1 LIMIT 1', [email]);
    const client = userQuery.rows[0];

    if (!client || !(await bcrypt.compare(password, client.password))) {
      return reply.status(401).send({ status: "UNAUTHORIZED", message: "Invalid profile credentials." });
    }

    const token = jwt.sign({ clientId: client.id, email: client.email }, JWT_SECRET, { expiresIn: '7d' });
    return reply.status(200).send({ status: "SUCCESS", token, apiKey: client.apiKey, companyName: client.companyName, balanceMetricUnits: client.balanceCents.toString() });
  } catch (err: any) {
    return reply.status(500).send({ status: "ERROR", message: "Internal Auth Gateway Timeout" });
  }
});

// ─── ENDPOINT 3: REAL-TIME STREAM CONNECTOR ───
fastify.register(async function (fastify) {
  fastify.get('/gravity-stream', { websocket: true }, (connection, req) => {
    const isDashboardClient = req.query && (req.query as any).dashboard === 'true';
    if (isDashboardClient) {
      console.log("🖥️ Secure Next.js Analytics Dashboard channel linked successfully!");
      return;
    }

    connection.on('message', async (message) => {
      let clientDb;
      try {
        const payload: TelemetryPayload = JSON.parse(message.toString());
        const { apiKey, action, deviceFingerprint, gyroWobble, lightFrequency, clockDrift, token } = payload;

        if (action === "MANUAL_BAN_OVERRIDE") {
          BLACKLISTED_DEVICES.add(deviceFingerprint);
          return;
        }

        if (BLACKLISTED_DEVICES.has(deviceFingerprint)) {
          connection.send(JSON.stringify({ status: "BLOCKED", reason: "Device blacklisted." }));
          connection.terminate();
          return;
        }

        const clientCheck = await pool.query('SELECT * FROM "EnterpriseClient" WHERE "apiKey" = $1 LIMIT 1', [apiKey]);
        const client = clientCheck.rows[0]; 

        if (!client) {
          connection.send(JSON.stringify({ status: "REJECTED", reason: "Unauthorized API Key" }));
          return;
        }

        if (BigInt(client.balanceCents) <= 0n) {
          connection.send(JSON.stringify({ status: "REJECTED", reason: "Insufficient Infrastructure Credits" }));
          return;
        }

        const isBotSignature = AIPredicativeWorker.shouldIsolateDevice({ gyroWobble: gyroWobble || 0, lightFrequency: lightFrequency || 0, clockDrift: clockDrift || 0 });
        if (isBotSignature) {
          BLACKLISTED_DEVICES.add(deviceFingerprint);
          connection.send(JSON.stringify({ status: "BANNED", reason: "AI firewall block." }));
          return;
        }

        const isHuman = ChaosEngine.verifyPresence(token || "", { gyroWobble: gyroWobble || 0, lightFrequency: lightFrequency || 0, clockDrift: clockDrift || 0 }, MASTER_SECRET);

        clientDb = await pool.connect();
        await clientDb.query('BEGIN');

        await clientDb.query(
          'INSERT INTO "ValidationLog" (id, "enterpriseClientId", "deviceFingerprint", "isHuman", "chaosHash", "revenueGenerated", "timestamp") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())',
          [client.id, deviceFingerprint, isHuman, token, 0.00001]
        );

        const updateLedger = await clientDb.query(
          'UPDATE "EnterpriseClient" SET "balanceCents" = "balanceCents" - 1 WHERE id = $1 RETURNING *',
          [client.id]
        );
        
        await clientDb.query('COMMIT');
        const updatedClient = updateLedger.rows[0];

        console.log(`[💸 SECURED] ${updatedClient.companyName} | Balance Units: ${updatedClient.balanceCents}`);

        const responsePacket = { 
          status: "SUCCESS", 
          authenticated: isHuman, 
          deviceFingerprint: deviceFingerprint,
          balanceMetricUnits: updatedClient.balanceCents.toString()
        };

        broadcastToDashboards(responsePacket);
        connection.send(JSON.stringify(responsePacket));

      } catch (err) {
        if (clientDb) await clientDb.query('ROLLBACK');
        connection.send(JSON.stringify({ status: "ERROR", error: "Internal processing crash." }));
      } finally {
        if (clientDb) clientDb.release();
      }
    });
  });
});

fastify.post('/v1/billing/webhook', { config: { rawBody: true } }, async (request, reply) => {
  const sig = request.headers['stripe-signature'] as string;
  const payload = request.body as any;

  if (sig === 't=123,v1=mock_signature_hash_data') {
    const clientApiKey = payload.data.object.metadata.apiKey;
    const purchasedCreditsCents = payload.data.object.amount_total;

    try {
      const updateLedger = await pool.query(
        'UPDATE "EnterpriseClient" SET "balanceCents" = "balanceCents" + $1 WHERE "apiKey" = $2 RETURNING *',
        [purchasedCreditsCents, clientApiKey]
      );
      const updatedClient = updateLedger.rows[0];
      
      broadcastToDashboards({
        status: "SUCCESS",
        authenticated: true,
        deviceFingerprint: "STRIPE_TOP_UP_NODE",
        balanceMetricUnits: updatedClient.balanceCents.toString()
      });

      return reply.status(200).send({ received: true });
    } catch (dbErr) {
      return reply.status(500).send("Database sync crash");
    }
  }
  reply.status(200).send({ received: true });
});

// ─── START THE SYSTEM RUNTIME ENGINE ───
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 8080;
    
    // 1. Establish the network port channel boundary cleanly first
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 NEXORA GRAVITY RUNNING LIVE ON GLOBAL CLOUD NETWORKS`);
    console.log(`========================================================================`);
    console.log(`Active Stream Input Channel opened on port: ${port}\n`);

    // 2. Safely generate and optimize backend storage structural matrices
    try {
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

      await pool.query('CREATE INDEX IF NOT EXISTS idx_enterprise_apikey ON "EnterpriseClient"("apiKey");');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_validation_device ON "ValidationLog"("deviceFingerprint");');
      console.log("✅ Database infrastructure layers established and indexed safely!");
    } catch (dbErr: any) {
      console.error("⚠️ Background Database Setup Warning:", dbErr.message);
    }

    // 3. Kick off your automated systems vitals agent monitor interval loops
    setInterval(() => { MonitorAgent.sampleSystemVitals(); }, 5000);

  } catch (err: any) {
    console.error("❌ Fatal port crash encountered:", err.message);
    process.exit(1);
  }
};

start();
