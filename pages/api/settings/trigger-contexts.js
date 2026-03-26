/**
 * GET /api/settings/trigger-contexts
 *
 * Returns the full TRIGGER_CONTEXTS map with flag option arrays populated
 * from the live `settings` table. The client-side trigger editor should call
 * this instead of importing TRIGGER_CONTEXTS directly.
 *
 * Response shape:
 * {
 *   success: true,
 *   data: {
 *     contexts: { bookings: {...}, guests: {...}, ... },  // full enriched map
 *     flagOptions: {
 *       guestFlagOptions: string[],
 *       bookingFlagOptions: string[]
 *     }
 *   }
 * }
 */

import { buildTriggerContextsFromDB, fetchFlagOptionsFromDB } from "../../../services/triggerContextRegistry";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { guestFlagOptions, bookingFlagOptions } = await fetchFlagOptionsFromDB();
    const contexts = await buildTriggerContextsFromDB();

    return res.status(200).json({
      success: true,
      data: {
        contexts,
        flagOptions: { guestFlagOptions, bookingFlagOptions },
      },
    });
  } catch (error) {
    console.error('Error building trigger contexts:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}