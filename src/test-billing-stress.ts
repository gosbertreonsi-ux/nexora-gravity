import http from 'http';
import crypto from 'crypto';

const TARGET_HOST = 'localhost';
const TARGET_PORT = 8080;
const TARGET_PATH = '/v1/billing/webhook';
const API_KEY = 'test_bank_key_123'; // Links directly to our seeded corporate bank client

console.log('💰 NEXORA Global Subscription Billing Stress Engine Initializing...');

function sendMockStripeWebhook() {
  // Generate randomized transaction figures to simulate distinct global companies topping up credits
  const randomAmount = Math.floor(Math.random() * 50000) + 1000; // Simulates $10.00 to $500.00 purchases
  const mockEventId = 'evt_' + crypto.randomBytes(12).toString('hex');
  const mockSessionId = 'cs_test_' + crypto.randomBytes(16).toString('hex');

  // Re-construct the exact nested JSON structure expected by our production Stripe pipeline layout
  const payload = JSON.stringify({
    id: mockEventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: mockSessionId,
        amount_total: randomAmount,
        currency: 'usd',
        payment_status: 'paid',
        metadata: {
          apiKey: API_KEY
        }
      }
    }
  });

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: TARGET_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Stripe-Signature': 't=123,v1=mock_signature_hash_data' // Passes loose firewall staging checks
    }
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log(`[💸 FLOOD SUCCESS] Simulated Top-Up Captured! Allocated: +$${(randomAmount / 100).toFixed(2)} Credit Units.`);
    } else {
      console.error(`[⚠️ REJECTED] Webhook returned status error flag: ${res.statusCode}`);
    }
  });

  req.on('error', (e) => {
    console.error(`❌ Connection breakdown on payment channel: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// Fire an endless loop of continuous payment requests every 800 milliseconds
console.log('🚀 Launching infinite concurrent global payment stream nodes...');
setInterval(() => {
  sendMockStripeWebhook();
}, 800);
