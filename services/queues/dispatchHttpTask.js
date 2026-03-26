import EmailTriggerService from '../booking/emailTriggerService.js';

const { CloudTasksClient } = require('@google-cloud/tasks');

const client = new CloudTasksClient();

export default async function createHttpTaskWithToken(url, httpMethod, payload = null, seconds = null) {
  const project = 'sargood-359200';
  const queue = 'sargood-359200';
  const location = 'asia-southeast2';
  const serviceAccountEmail = 'sargood-cloud-run@sargood-359200.iam.gserviceaccount.com';

  const parent = client.queuePath(project, location, queue);

  const task = {
    httpRequest: {
      httpMethod,
      headers: { 'Content-Type': 'application/json' },
      url,
      oidcToken: { serviceAccountEmail, audience: url },
    },
  };

  if (payload) {
    task.httpRequest.body = Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  if (seconds) {
    task.scheduleTime = {
      seconds: parseInt(seconds) + Date.now() / 1000,
    };
  }

  console.log('Sending task:');
  console.log('  URL:', url);
  console.log('  Method:', httpMethod);

  const [response] = await client.createTask({ parent, task });
  console.log(`Created task ${response.name}`);
}

/**
 * dispatchHttpTaskHandler(typeOrUrl, payload, seconds)
 *
 * Supports two calling conventions:
 *   1. Type string (legacy):  dispatchHttpTaskHandler('booking', payload)
 *   2. Direct URL (new):      dispatchHttpTaskHandler('https://...', payload)
 *
 * LOCAL DEVELOPMENT (NODE_ENV=development or non-HTTPS URL):
 *   Bypasses HTTP entirely — calls services directly to avoid Next.js
 *   self-fetch 404 issues where API routes can't reliably fetch other
 *   API routes on the same dev server process.
 *
 *   evaluateEmailTriggers  → EmailTriggerService.evaluateAndSendTriggers()
 *   sendTriggerEmail       → EmailService.sendWithTemplate() directly
 *   All others             → skipped with warning (require external services not available in dev)
 *
 * PRODUCTION (HTTPS URL):
 *   Enqueues via Google Cloud Tasks.
 */
export async function dispatchHttpTaskHandler(typeOrUrl, payload = null, seconds = null) {
  let url;
  const httpMethod = 'POST';

  // ── Resolve URL ─────────────────────────────────────────────────────────
  if (typeOrUrl && (typeOrUrl.startsWith('http://') || typeOrUrl.startsWith('https://'))) {
    url = typeOrUrl;
  } else {
    // Legacy type-string mapping
    switch (typeOrUrl) {
      case 'booking':
        url = process.env.APP_URL + '/api/bookings/service-task';
        break;
      default:
        console.warn(`⚠️ dispatchHttpTaskHandler: unknown type '${typeOrUrl}' — skipping`);
        return;
    }
  }

  const isLocal = process.env.NODE_ENV === 'development' || !url.startsWith('https://');

  // ── LOCAL: bypass HTTP, call services directly ───────────────────────────
  if (isLocal) {
    console.log(`⚠️ Local dev — processing task directly (no HTTP): type=${payload?.type}`);

    // ── evaluateEmailTriggers ──────────────────────────────────────────────
    // Calls EmailTriggerService directly to avoid Next.js self-fetch 404.
    if (payload?.type === 'evaluateEmailTriggers') {
      try {
        // Was evaluateAndSendTriggers() which only fetches 'system' triggers.
        // Booking form triggers (internal/external) require evaluateBookingFormTriggers().
        // This matches what service-task.js does when it receives this task type.
        const result = await EmailTriggerService.evaluateBookingFormTriggers(
          payload.payload.booking_id,
          payload.payload.context || 'default'
        );

        console.log(`✅ evaluateEmailTriggers (local): ${result.queued} queued, ${result.skipped} skipped, ${result.errored} errors`);
        return { success: true, result };
      } catch (err) {
        console.error('❌ evaluateEmailTriggers (local) error:', err);
        throw err;
      }
    }

    // ── sendTriggerEmail ───────────────────────────────────────────────────
    // Loads trigger from DB and sends via EmailService directly.
    if (payload?.type === 'sendTriggerEmail') {
      try {
        const { trigger_id, recipient, email_data } = payload.payload;

        if (!trigger_id) throw new Error('sendTriggerEmail: missing trigger_id');
        if (!recipient)  throw new Error('sendTriggerEmail: missing recipient');
        if (!email_data) throw new Error('sendTriggerEmail: missing email_data');

        // Dynamic imports avoid circular dependency
        const { EmailTrigger, EmailTemplate } = await import('../../models');
        const { default: EmailService } = await import('../booking/emailService.js');

        const trigger = await EmailTrigger.findByPk(trigger_id, {
          include: [{ model: EmailTemplate, as: 'template' }]
        });

        if (!trigger) throw new Error(`sendTriggerEmail: trigger ${trigger_id} not found`);
        if (!trigger.email_template_id) throw new Error(`sendTriggerEmail: trigger ${trigger_id} has no template`);

        console.log(`📧 sendTriggerEmail (local): trigger #${trigger_id} → template #${trigger.email_template_id} → ${recipient}`);

        await EmailService.sendWithTemplate(recipient, trigger.email_template_id, email_data, { useFallback: true });

        console.log(`✅ sendTriggerEmail (local): sent to ${recipient}`);
        return { success: true };
      } catch (err) {
        console.error('❌ sendTriggerEmail (local) error:', err);
        throw err;
      }
    }

    // ── All other task types (PDF generation, etc.) ──────────────────────
    // In local dev, these tasks (e.g. generate-and-upload-pdf) require
    // external services (Puppeteer, Docker, GCS) that aren't available locally.
    // Log and skip gracefully rather than throwing and rolling back the status update.
    console.log(`⏭️  Skipping task in local dev (not supported without external services): ${url}`);
    console.log(`   Payload type: ${payload?.type || '(direct URL call — no type wrapper)'}`);
    return { success: false, skipped: true, reason: 'Local dev — external service task skipped' };
  }

  // ── PRODUCTION: enqueue via Cloud Tasks ─────────────────────────────────
  return createHttpTaskWithToken(url, httpMethod, payload, seconds);
}