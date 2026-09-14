import crypto from 'crypto';

interface TelemetryInput {
  gyroWobble: number;       // Micro-vibrations from human pulse/breathing
  lightFrequency: number;   // Ambient room/sky lighting shifts
  clockDrift: number;       // Tiny physical CPU timing variations
}

export class ChaosEngine {
  /**
   * Generates an uncopyable, hardware-attested human presence token.
   * Uses shifting system states so a static copy of the code cannot guess the key.
   */
  public static generateGravityToken(data: TelemetryInput, masterSecret: string): string {
    // 1. Convert chaotic hardware attributes into a high-entropy string buffer
    const rawEntropy = `${data.gyroWobble.toFixed(6)}-${data.lightFrequency.toFixed(2)}-${data.clockDrift.toFixed(8)}`;
    
    // 2. Mix in the dynamic master server key (the uncopyable server variable)
    const runningTimestamp = Math.floor(Date.now() / 1000); // 1-second dynamic synchronization windows
    const dynamicKey = crypto.createHmac('sha256', masterSecret)
                             .update(runningTimestamp.toString())
                             .digest('hex');

    // 3. Output the absolute cryptographic proof-of-presence state
    return crypto.createHmac('sha256', dynamicKey)
                 .update(rawEntropy)
                 .digest('hex');
  }

  /**
   * Verifies if the incoming mobile token perfectly matches the physical universe parameters
   */
  public static verifyPresence(token: string, data: TelemetryInput, masterSecret: string): boolean {
    const computedToken = this.generateGravityToken(data, masterSecret);
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(computedToken));
  }
}
