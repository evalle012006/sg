import { runDeadlineEnforcementSweep } from '../../../services/booking/deadlineEnforcementService';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const providedToken = req.headers['x-internal-token'];
    if (!process.env.INTERNAL_CRON_TOKEN || providedToken !== process.env.INTERNAL_CRON_TOKEN) {
        return res.status(401).json({ error: 'Unauthorised' });
    }

    try {
        const result = await runDeadlineEnforcementSweep();
        console.log(`⏰ Deadline sweep triggered via API:`, result);
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        console.error('❌ Deadline sweep failed:', err);
        return res.status(500).json({ error: err.message });
    }
}