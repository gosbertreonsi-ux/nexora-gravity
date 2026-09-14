import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import pg from 'pg';
import { ChaosEngine } from '../crypto/chaosEngine';

const { Pool } = pg;
const fastify = Fastify({ logger: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/nexora_gravity?schema=public"
});

const MASTER_SECRET = process.env.MASTER_SECRET || "nexora_absolute_entropy_shield_2026";
const BLACKLISTED_DEVICES = new Set<string>(); // In-memory lightning-fast IP/Device ban ledger

fastify.register(fastifyWebsocket);

interface TelemetryPayload {
  apiKey: string;
  deviceFingerprint: string;
  gyroWobble: number;
  lightFrequency: number;
  clockDrift: number;
  token: string;
}

fastify.register(async function (fastify) {
  fastify.get('/gravity-stream', { websocket: true }, (connection, req) => {
    
    connection.on('message', async (message) => {
      let clientDb;
      try {
        const payload: TelemetryPayload = JSON.parse(message.toString());
        const { apiKey, deviceFingerprint, gyroWobble, lightFrequency, clockDrift, token } = payload;

        // SECURITY CHECK 1: Immediate Blacklist/Firewall Check
        if (BLACKLISTED_DEVICES.has(deviceFingerprint)) {
          connection.send(JSON.stringify({ status: "BLOCKED", reason: "Device blacklisted due to previous malicious telemetry profile spoofing." }));
          connection.terminate();
          return;
        }

        // SECURITY CHECK 2: Validate Client API Key Authenticity
        const clientCheck = await pool.query('SELECT * FROM "EnterpriseClient" WHERE "apiKey" = $1 LIMIT 1', [apiKey]);
        const client = clientCheck.rows[0];

        if (!client) {
          connection.send(JSON.stringify({ status: "REJECTED", reason: "Unauthorized API Key Signature Grid" }));
          return;
        }

        // SECURITY CHECK 3: Cryptographic Mathematical Boundary Inspection
        // Human breathing/pulses cannot physically cause extreme gyroscopic values. If bounds fail, it's a bot.
        if (gyroWobble > 0.5 || gyroWobble < -0.5 || lightFrequency < 0) {
          console.warn(`[🚨 FIREWALL FLAG] Fraudulent physical bounds detected from device: ${deviceFingerprint}. Banning node.`);
          BLACKLISTED_DEVICES.add(deviceFingerprint);
          connection.send(JSON.stringify({ status: "BANNED", reason: "Physical telemetry anomaly triggered automated firewall block." }));
          return;
        }

        // 2. Compute true human physical presence against the Dynamic Chaos Matrix
        const isHuman = ChaosEngine.verifyPresence(token, { gyroWobble, lightFrequency, clockDrift }, MASTER_SECRET);

        // 3. Atomically update enterprise revenue account metrics
        clientDb = await pool.connect();
        await clientDb.query('BEGIN');

        await clientDb.query(
          'INSERT INTO "ValidationLog" (id, "enterpriseClientId", "deviceFingerprint", "isHuman", "chaosHash", "revenueGenerated", "timestamp") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())',
          [client.id, deviceFingerprint, isHuman, token, 0.00001]
        );

        const updateLedger = await clientDb.query(
          'UPDATE "EnterpriseClient" SET "balanceCents" = "balanceCents" + 1 WHERE id = $1 RETURNING *',
          [client.id]
        );
        
        await clientDb.query('COMMIT');
        const updatedClient = updateLedger.rows[0];

        console.log(`[💸 SECURED & FIREWALLED] ${updatedClient.companyName} | Rev Units: ${updatedClient.balanceCents}`);

        connection.send(JSON.stringify({ 
          status: "SUCCESS", 
          authenticated: isHuman, 
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

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 8080;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 NEXORA GRAVITY RUNNING SECURELY WITH AUTOMATED FIREWALLS`);
    console.log(`=============================================================`);
    console.log(`Listening on: ws://localhost:8080/gravity-stream\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
