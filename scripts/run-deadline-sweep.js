/**
 * AOB-24 / AOB-25: scheduled sweep for the 48-hour payment deadline.
 * Invoke via cron/PM2 on a schedule appropriate to the shortest configured
 * reminder threshold — e.g. every 15-30 minutes for production (48h/24h
 * schedule), or every 10-30 seconds if temporarily testing a sub-minute
 * schedule like "10m,5s".
 *
 * Usage: node scripts/run-deadline-sweep.js
 */

import { runDeadlineEnforcementSweep } from '../services/booking/deadlineEnforcementService.js';

async function main() {
    console.log(`\n⏰ Starting deadline enforcement sweep at ${new Date().toISOString()}`);

    try {
        const result = await runDeadlineEnforcementSweep();
        console.log(`⏰ Sweep finished:`, result);
        process.exit(0);
    } catch (err) {
        console.error('❌ Deadline sweep failed:', err);
        process.exit(1);
    }
}

main();