import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import pg from 'pg';
import Stripe from 'stripe';
import { ChaosEngine } from '../crypto/chaosEngine';
import { AIPredicativeWorker } from '../ai/predictiveWorker';
import { MonitorAgent } from '../telemetry/monitorAgent';

const { Pool } = pg;
const fastify = Fastify({ logger: true });

fastify.register(fastifyCors, {
  origin: "*", 
  methods: ["GET", "POST", "PUT", "DELETE"]
});

fastify.register(fastifyWebsocket);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:1971@localhost:5432/nexora_gravity?schema=public"
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_secret_key_123', {
  apiVersion: '2023-10-16' as any
});

const MASTER_SECRET = process.env.MASTER_SECRET || "nexora_absolute_entropy_shield_2026";
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

fastify.register(async function (fastify) {
  fastify.get('/gravity-stream', { websocket: true }, (connection, req) => {
    connection.on('message', async (message) => {
      let clientDb;
      try {
        const payload: TelemetryPayload = JSON.parse(message.toString());
        const { apiKey, action, deviceFingerprint, gyroWobble, lightFrequency, clockDrift, token } = payload;

        // NEW LOGIC CORE: PROCESS MANUAL FRONTEND BAN FIREWALL SUBMISSIONS OVER SOCKETS
        if (action === "MANUAL_BAN_OVERRIDE") {
          console.warn(`[🚨 MANUAL OVERRIDE OVER SYSTEM] Administrator banned target device fingerprint node: ${deviceFingerprint}`);
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
          console.warn(`[🤖 AI BLOCKER] Synthetic device emulation predicted. Adding ${deviceFingerprint} to block pool.`);
          BLACKLISTED_DEVICES.add(deviceFingerprint);
          connection.send(JSON.stringify({ status: "BANNED", reason: "AI filters locked device." }));
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

        connection.send(JSON.stringify({ 
          status: "SUCCESS", 
          authenticated: isHuman, 
          deviceFingerprint: deviceFingerprint,
          balanceMetricUnits: updatedClient.balanceCents.toString()
        }));

      } catch (err) {
        if (clientDb) await clientDb.query('ROLLBACK');
        connection.send(JSON.stringify({ status: "ERROR", error: "Malformed Packet Structure" }));
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
      await pool.query(
        'UPDATE "EnterpriseClient" SET "balanceCents" = "balanceCents" + $1 WHERE "apiKey" = $2',
        [purchasedCreditsCents, clientApiKey]
      );
      console.log(`[💰 MOCK STRIPE TOP-UP] Credited $${(purchasedCreditsCents / 100).toFixed(2)} to client key: ${clientApiKey}`);
      return reply.status(200).send({ received: true });
    } catch (dbErr) {
      return reply.status(500).send("Database sync crash");
    }
  }

  reply.status(200).send({ received: true });
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 8080;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 NEXORA GRAVITY RUNNING SAFELY ON NATIVE ENGINE WITH AI DETECTORS`);
    console.log(`========================================================================`);
    console.log(`Connected directly to PostgreSQL cluster bypassing broken CLI dependencies.`);
    console.log(`Active Stream Input: ws://localhost:8080/gravity-stream\n`);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_enterprise_apikey ON "EnterpriseClient"("apiKey");');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_validation_device ON "ValidationLog"("deviceFingerprint");');

    setInterval(() => {
      MonitorAgent.sampleSystemVitals();
    }, 5000);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
