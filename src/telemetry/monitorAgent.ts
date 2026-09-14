import os from 'os';

export class MonitorAgent {
  // Expanded memory ceiling metric (16GB) to scale gracefully with your Windows machine space
  private static MEMORY_THRESHOLD_MB = 16384; 

  /**
   * Samples live operating system metrics and prints health diagnostics to the console.
   * Emits emergency automation hooks if infrastructure limits are crossed.
   */
  public static sampleSystemVitals(): void {
    const freeMemoryBytes = os.freemem();
    const totalMemoryBytes = os.totalmem();
    const usedMemoryMB = Math.floor((totalMemoryBytes - freeMemoryBytes) / 1024 / 1024);
    
    const cpuLoad = os.loadavg(); 
    const systemUptimeHours = (os.uptime() / 3600).toFixed(2);

    console.log(`[📊 HEALTH SAMPLER] Uptime: ${systemUptimeHours}h | RAM In Use: ${usedMemoryMB}MB | CPU Load (1m): ${cpuLoad[0].toFixed(2)}`);

    // SYSTEM ALERT CRITERIA: Fire automated webhooks if thresholds break
    if (usedMemoryMB > this.MEMORY_THRESHOLD_MB) {
      this.triggerEmergencyAutomationAlert(`CRITICAL: Memory leak sequence predicted. Current Usage: ${usedMemoryMB}MB`);
    }
  }

  /**
   * Simulates an outbound alerting protocol to ping system administrators
   */
  private static triggerEmergencyAutomationAlert(message: string): void {
    console.error(`\n[🚨 INFRASTRUCTURE ALARM] ${message}`);
    console.error(`=> Dispatching autonomous incident payloads to recovery nodes...\n`);
  }
}
