import WebSocket from 'ws';
import crypto from 'crypto';
import https from 'https';

const SERVER_HOST = 'nexora-gravity-production.up.railway.app';
const MASTER_SECRET = "nexora_absolute_entropy_shield_2026";

console.log('⚡ NEXORA Gravity Dynamic Device Fleet Simulator Initializing...');

const uniqueId = crypto.randomBytes(8).toString('hex').toUpperCase();
const randomCompany = `Simulation Fleet Node ${uniqueId}`;
const mockEmail = `fleet-${uniqueId.toLowerCase()}@nexus.nexora`;

// Encode data into clean form-urlencoded layout to match cloud firewalls
const signupPayload = new URLSearchParams({
  companyName: randomCompany,
  email: mockEmail,
  password: "hardened_simulation_secret_2026"
}).toString();

const signupOptions = {
  hostname: SERVER_HOST,
  port: 443,
  path: '/v1/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(signupPayload)
  }
};

const signupReq = https.request(signupOptions, (res) => {
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    try {
      const authData = JSON.parse(rawData);
      if (authData.status === "SUCCESS") {
        const harvestedApiKey = authData.apiKey;
        console.log(`\n🔑 [CLOUD AUTH SUCCESS] Dynamic Corporate Token Secured!`);
        console.log(`🏢 Entity: ${authData.companyName}`);
        console.log(`🎫 Active Key: ${harvestedApiKey}\n`);
        
        startDeviceSimulation(harvestedApiKey);
      } else {
        console.error('❌ Authentication block validation drop:', authData.message || rawData);
      }
    } catch (e) {
      console.error('❌ Failed to parse corporate auth response matrix:', e);
    }
  });
});

signupReq.on('error', (err) => {
  console.error('❌ Core cloud auth channel unreachable:', err.message);
});
signupReq.write(signupPayload);
signupReq.end();

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

function startDeviceSimulation(activeApiKey: string) {
  const SERVER_URL = `wss://${SERVER_HOST}/gravity-stream`;
  const ws = new WebSocket(SERVER_URL);

  ws.on('open', () => {
    console.log('🟢 Securely linked to NEXORA Cloud Ingestion Core. Ingress loop active...');

    setInterval(() => {
      const gyroWobble = 0.001234 + (Math.random() - 0.5) * 0.0001;
      const lightFrequency = 59.98 + (Math.random() - 0.5) * 0.05;
      const clockDrift = 0.00000012 + (Math.random() - 0.5) * 0.00000001;
      const deviceFingerprint = 'sim_node_' + crypto.randomBytes(8).toString('hex').toUpperCase();

      const token = generateSimulatedToken(gyroWobble, lightFrequency, clockDrift);

      const packet = {
        apiKey: activeApiKey,
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
    console.log('🔴 Stream pipeline dropped. Attempting automated reconnection block...');
  });
}
