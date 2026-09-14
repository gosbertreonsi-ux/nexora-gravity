import WebSocket from 'ws';
import crypto from 'crypto';

const SERVER_URL = 'ws://localhost:8080/gravity-stream';
const API_KEY = 'test_bank_key_123'; // Matches our corporate seeded client
const MASTER_SECRET = "nexora_absolute_entropy_shield_2026";

console.log('⚡ NEXORA Gravity Device Fleet Simulator Initializing...');

function generateSimulatedToken(gyro: number, light: number, drift: number): string {
  const rawEntropy = `${gyro.toFixed(6)}-${light.toFixed(2)}-${drift.toFixed(8)}`;
  const runningTimestamp = Math.floor(Date.now() / 1000);
  const dynamicKey = crypto.createHmac('sha256', MASTER_SECRET)
                           .update(runningTimestamp.toString())
                           .digest('hex');

  return crypto.createHmac('sha256', dynamicKey)
               .update(rawEntropy)
               .digest('hex');
}

function startDeviceSimulation() {
  const ws = new WebSocket(SERVER_URL);

  ws.on('open', () => {
    console.log('🟢 Connected to NEXORA Ingestion Core. Initializing global device stream...');

    // Simulate a phone sending telemetry metrics every 1.5 seconds
    setInterval(() => {
      // Create random human body micro-jitters and physical chip drift metrics
      const gyroWobble = 0.001234 + (Math.random() - 0.5) * 0.0001;
      const lightFrequency = 59.98 + (Math.random() - 0.5) * 0.05;
      const clockDrift = 0.00000012 + (Math.random() - 0.5) * 0.00000001;
      const deviceFingerprint = crypto.randomBytes(16).toString('hex');

      // Generate the cryptographic validation key locally matching hardware physics
      const token = generateSimulatedToken(gyroWobble, lightFrequency, clockDrift);

      const packet = {
        apiKey: API_KEY,
        deviceFingerprint,
        gyroWobble,
        lightFrequency,
        clockDrift,
        token
      };

      ws.send(JSON.stringify(packet));
    }, 1500);
  });

  ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    console.log(`[🛰️ PHONE DATA SENT] Server Response:`, response);
  });

  ws.on('close', () => {
    console.log('🔴 Stream disconnected. Attempting automatic reconnection node...');
    setTimeout(startDeviceSimulation, 3000);
  });

  ws.on('error', (err) => {
    console.error('❌ Connection pipeline error:', err.message);
  });
}

startDeviceSimulation();
