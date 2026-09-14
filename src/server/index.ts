import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import pg from 'pg';
import Stripe from 'stripe';
import { ChaosEngine } from '../crypto/chaosEngine';

const { Pool } = pg;
const fastify = Fastify({ logger: true });

// 1. Initialize High-Velocity Postgres Connections & Stripe API bindings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/nexora_gravity?schema=public"
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_secret_key_123', {
  apiVersion: '2023-10-16' as any
});

const MASTER_SECRET = process.env.MASTER_SECRET || "nexora_absolute_entropy_shield_2026";
const BLACKLISTED_DEVICES = new Set<string>();

// REGISTER SYSTEM WEB PLUGINS
fastify.register(fastifyWebsocket);

interface TelemetryPayload {
  apiKey: string;
  deviceFingerprint: string;
  gyroWobble: number;
  lightFrequency: number;
  clockDrift: number;
  token: string;
}

// ─── ENDPOINT 1: THE CORE AUTOMATED STREAMING LEDGER ───
fastify.register(async function (fastify) {
  fastify.get('/gravity-stream', { websocket: true }, (connection, req) => {
    connection.on('message', async (message) => {
      let clientDb;
      try {
        const payload: TelemetryPayload = JSON.parse(message.toString());
        const { apiKey, deviceFingerprint, gyroWobble, lightFrequency, clockDrift, token } = payload;

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

        // PREVENT FRAUD: Enforce pre-paid balance rules before validating traffic
        if (BigInt(client.balanceCents) <= 0n) {
          connection.send(JSON.stringify({ status: "REJECTED", reason: "Insufficient Infrastructure Balance Credits" }));
          return;
        }

        if (gyroWobble > 0.5 || gyroWobble < -0.5 || lightFrequency < 0) {
          BLACKLISTED_DEVICES.add(deviceFingerprint);
          connection.send(JSON.stringify({ status: "BANNED", reason: "Physical telemetry anomaly triggered automated firewall block." }));
          return;
        }

        const isHuman = ChaosEngine.verifyPresence(token, { gyroWobble, lightFrequency, clockDrift }, MASTER_SECRET);

        clientDb = await pool.connect();
        await clientDb.query('BEGIN');

        await clientDb.query(
          'INSERT INTO "ValidationLog" (id, "enterpriseClientId", "deviceFingerprint", "isHuman", "chaosHash", "revenueGenerated", "timestamp") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())',
          [client.id, deviceFingerprint, isHuman, token, 0.00001]
        );

        // Usage matrix depletion step (deducts 1 balance credit point per verified hit)
        const updateLedger = await clientDb.query(
          'UPDATE "EnterpriseClient" SET "balanceCents" = "balanceCents" - 1 WHERE id = $1 RETURNING *',
          [client.id]
        );
        
        await clientDb.query('COMMIT');
        const updatedClient = updateLedger.rows[0];

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

// ─── ENDPOINT 2: STRIPE AUTONOMOUS CREDIT TOP-UP WEBHOOK ───
// This route fires automatically when an enterprise client purchases API capacity packages
fastify.post('/v1/billing/webhook', { config: { rawBody: true } }, async (request, reply) => {
  const sig = request.headers['stripe-signature'] as string;
  let event;

  try {
    // In production, verify the webhook source integrity directly using Stripe keys
    const bodyStr = JSON.stringify(request.body);
    event = stripe.webhooks.constructEvent(bodyStr, sig, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test');
  } catch (err: any) {
    return reply.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful credit transactions seamlessly 24/7
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const clientApiKey = session.metadata.apiKey;
    const purchasedCreditsCents = session.amount_total; // Map direct purchase volume to credit allocation

    try {
      await pool.query(
        'UPDATE "EnterpriseClient" SET "balanceCents" = "balanceCents" + $1 WHERE "apiKey" = $2',
        [purchasedCreditsCents, clientApiKey]
      );
      console.log(`[💰 STRIPE PAYMENT SECURED] Credited $${(purchasedCreditsCents / 100).toFixed(2)} capacity units to API: ${clientApiKey}`);
    } catch (dbErr) {
      console.error('Failed to sync incoming transaction matrix to storage layer:', dbErr);
    }
  }

  reply.status(200).send({ received: true });
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 8080;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 NEXORA GRAVITY RUNNING METRIC REVENUE ENGINE WITH INTEGRATED STRIPE LINKS`);
    console.log(`================================================================================`);
    console.log(`Active API Stream Input: ws://localhost:8080/gravity-stream`);
    console.log(`Webhook Billing Target:  http://localhost:8080/v1/billing/webhook\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
