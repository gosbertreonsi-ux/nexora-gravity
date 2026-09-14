import http from 'http';
import crypto from 'crypto';

const SERVER_HOST = 'localhost';
const SERVER_PORT = 8080;

console.log('💰 NEXORA Global Subscription Billing Stress Engine Initializing...');

const randomCompany = `Stress Financial Node ${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
const mockEmail = `billing-stress-${crypto.randomBytes(4).toString('hex')}@apex.nexora`;

const signupPayload = JSON.stringify({
  companyName: randomCompany,
  email: mockEmail,
  password: "hardened_billing_secret_2026"
});

const signupOptions = {
  hostname: SERVER_HOST,
  port: SERVER_PORT,
  path: '/v1/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(signupPayload)
  }
};

const signupReq = http.request(signupOptions, (res) => {
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    try {
      const authData = JSON.parse(rawData);
      if (authData.status === "SUCCESS") {
        const harvestedApiKey = authData.apiKey;
        console.log(`\n¼ [BILLING AUTH HANDSHAKE SUCCESS] Financial Tracking Link Established!`);
        console.log(`🏢 Stress Asset Account: ${authData.companyName}`);
        console.log(`🎫 Active Target Key: ${harvestedApiKey}\n`);
        
        launchBillingStress(harvestedApiKey);
      } else {
        console.error('❌ Billing registration rejected:', authData.message);
      }
    } catch (e) {
      console.error('❌ Failed to parse transaction auth payload:', e);
    }
  });
});

signupReq.on('error', (err) => {
  console.error('❌ Billing network pathway unavailable:', err.message);
});
signupReq.write(signupPayload);
signupReq.end();

function launchBillingStress(targetApiKey: string) {
  // FIXED: Corrected console.or to console.log
  console.log('🚀 Launching infinite concurrent global payment stream nodes...');
  
  setInterval(() => {
    const randomAmount = Math.floor(Math.random() * 50000) + 1000;
    const mockEventId = 'evt_' + crypto.randomBytes(12).toString('hex');
    const mockSessionId = 'cs_test_' + crypto.randomBytes(16).toString('hex');

    const payload = JSON.stringify({
      id: mockEventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: mockSessionId,
          amount_total: randomAmount,
          currency: 'usd',
          payment_status: 'paid',
          metadata: { apiKey: targetApiKey }
        }
      }
    });

    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: '/v1/billing/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Stripe-Signature': 't=123,v1=mock_signature_hash_data'
      }
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log(`[💸 FLOOD SUCCESS] Simulated Top-Up Captured! Allocated: +$${(randomAmount / 100).toFixed(2)} Credits.`);
      }
    });

    req.on('error', (e) => {
      console.error(`❌ Payment stress connection fault: ${e.message}`);
    });

    req.write(payload);
    req.end();
  }, 800);
}
