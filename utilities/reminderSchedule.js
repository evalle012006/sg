// utilities/reminderSchedule.js

/**
 * Parses a comma-separated reminder schedule string like "48h,24h" or "10m,5s"
 * into an array of offsets in milliseconds before the deadline.
 * Supports h (hours), m (minutes), s (seconds) suffixes.
 * Throws on malformed input rather than silently ignoring bad tokens —
 * a misconfigured schedule should fail loudly in the cron log, not
 * silently skip reminders.
 */
export function parseReminderSchedule(scheduleString) {
    if (!scheduleString || !scheduleString.trim()) return [];

    const unitToMs = { h: 3600000, m: 60000, s: 1000 };

    return scheduleString.split(',').map(token => {
        const trimmed = token.trim();
        const match = trimmed.match(/^(\d+(?:\.\d+)?)(h|m|s)$/i);
        if (!match) {
            throw new Error(`Invalid reminder schedule token: "${trimmed}" — expected format like "48h", "24h", "10m", "5s"`);
        }
        const [, value, unit] = match;
        return {
            raw: trimmed,
            offsetMs: parseFloat(value) * unitToMs[unit.toLowerCase()],
        };
    });
}