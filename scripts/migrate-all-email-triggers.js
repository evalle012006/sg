/**
 * Data Migration Script: Convert System Emails to EmailTriggers
 * 
 * UPDATED: Now includes filter fields for safety and advanced filtering
 * 
 * This script creates EmailTrigger records for all existing hardcoded system emails,
 * allowing them to be managed through the EmailTrigger service instead of being
 * scattered throughout the codebase.
 * 
 * Usage: 
 *   node scripts/migrate-system-email-triggers.js           # Create new triggers
 *   node scripts/migrate-system-email-triggers.js --update  # Update existing triggers with filters
 *   node scripts/migrate-system-email-triggers.js --rollback # Delete all system triggers
 */

const { EmailTrigger, EmailTemplate } = require('../models');
const { Op } = require('sequelize');

const TEMPLATE_IDS = {
  // BOOKING
  BOOKING_AMENDED_ADMIN: 14, // Booking Amended Admin
  BOOKING_AMENDED: 15, // Booking Amended
  BOOKING_APPROVED: 16, // Booking Approved
  BOOKING_CANCELLED_ADMIN: 17, // Booking Cancelled Admin
  BOOKING_CANCELLED: 18, // Booking Cancelled
  BOOKING_CONFIRMED_ADMIN: 19, // Booking Confirmed Admin
  BOOKING_CONFIRMED: 20, // Booking Confirmed
  BOOKING_DECLINED: 21, // Booking Declined
  BOOKING_NOTIFY_DATE_OF_STAY: 22, // Booking Notify Date Of Stay
  BOOKING_SUMMARY: 23, // Booking Summary
  ICARE_NIGHTS_UPDATE: 32, // Icare Nights Update
  
  // NEW: Guest-initiated cancellation templates
  BOOKING_GUEST_CANCELLATION_REQUEST: 35, // Booking Guest Cancellation Request (guest email)
  BOOKING_GUEST_CANCELLATION_REQUEST_ADMIN: 36, // Booking Guest Cancellation Request Admin (admin email)

  // GUEST
  GUEST_PROFILE: 31, // Guest Profile

  // COURSE
  COURSE_EOI_ACCEPTED: 24, // Course Eoi Accepted
  COURSE_EOI_ADMIN: 25, // Course Eoi Admin
  COURSE_EOI_CONFIRMATION: 26, // Course Eoi Confirmation
  COURSE_OFFER_NOTIFICATION: 27, // Course Offer Notification

  // AUTH
  CREATE_ACCOUNT: 28, // Create Account
  EMAIL_ACCOUNT_TERMINATION: 29, // Email Account Termination
  EMAIL_CONFIRMATION_LINK: 30, // Email Confirmation Link
  RESET_PASSWORD_LINK: 33, // Reset Password Link
  TEAM_EMAIL_CONFIRMATION_LINK: 34, // Team Email Confirmation Link

  // OTHER
  MIGRATED_EXTERNAL_RECIPIENT_NEW_BOOKING: 1, // Migrated: External Recipient New Booking
  MIGRATED_BOOKING_HIGHLIGHTS: 2, // Migrated: Booking Highlights
  MIGRATED_INTERNAL_RECIPIENT_NEW_BOOKING: 3, // Migrated: Internal Recipient New Booking
  MIGRATED_FUNDER_EXTERNAL_BOOKING: 4, // Migrated: Funder External Booking
  MIGRATED_RECIPIENT_BOOKING_AMENDED: 5, // Migrated: Recipient Booking Amended
  MIGRATED_INTERNAL_RECIPIENT_HEALTH_INFO: 6, // Migrated: Internal Recipient Health Info
  MIGRATED_INTERNAL_RECIPIENT_FOUNDATION_STAY: 7, // Migrated: Internal Recipient Foundation Stay
  TEST_TEMPLATE: 8, // Test template
};

/**
 * System email trigger definitions
 * Each entry defines a trigger that should be created
 * 
 * NEW: Added filter fields for safety and advanced filtering
 */
const SYSTEM_EMAIL_TRIGGERS = [
  // ============================================================
  // BOOKING APPROVED
  // ============================================================
  {
    description: 'Send booking approved email to guest (first time guests)',
    type: 'system',
    trigger_context: 'booking_status_changed',
    context_conditions: {
      status_to: 'eligible',
      is_first_time_guest: true
    },
    email_template_id: TEMPLATE_IDS.BOOKING_APPROVED, // 16
    recipient: null, // Uses guest_email from context
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    booking_eligibility_filter: ['eligible'],
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },

  // ============================================================
  // BOOKING DECLINED
  // ============================================================
  {
    description: 'Send booking declined email to guest',
    type: 'system',
    trigger_context: 'booking_status_changed',
    context_conditions: {
      status_to: 'ineligible'
    },
    email_template_id: TEMPLATE_IDS.BOOKING_DECLINED, // 21
    recipient: null, // Uses guest_email from context
    priority: 10,
    enabled: true,
    // NEW: Safety filters (still send decline emails, just not to deceased/banned)
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },

  // ============================================================
  // BOOKING CONFIRMED
  // ============================================================
  {
    description: 'Send booking confirmed email to guest',
    type: 'system',
    trigger_context: 'booking_confirmed',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.BOOKING_CONFIRMED, // 20
    recipient: null, // Uses guest_email from context
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    booking_eligibility_filter: ['eligible'],
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send booking confirmed email to admin',
    type: 'system',
    trigger_context: 'booking_confirmed',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.BOOKING_CONFIRMED_ADMIN, // 19
    recipient: 'recipient_type:info', // Will be resolved to actual emails
    priority: 5,
    enabled: true
    // NOTE: No guest_flag_filter for admin emails - they need to see all bookings
  },

  // ============================================================
  // BOOKING CANCELLED (Admin-initiated)
  // ============================================================
  {
    description: 'Send booking cancelled email to guest (admin-initiated)',
    type: 'system',
    trigger_context: 'booking_cancelled',
    context_conditions: {
      cancelled_by: 'admin'
    },
    email_template_id: TEMPLATE_IDS.BOOKING_CANCELLED, // 18
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send booking cancelled email to admin (admin-initiated)',
    type: 'system',
    trigger_context: 'booking_cancelled',
    context_conditions: {
      cancelled_by: 'admin'
    },
    email_template_id: TEMPLATE_IDS.BOOKING_CANCELLED_ADMIN, // 17
    recipient: 'recipient_type:info',
    priority: 5,
    enabled: true
    // NOTE: No filters for admin emails
  },

  // ============================================================
  // BOOKING CANCELLED (Guest-initiated)
  // ============================================================
  {
    description: 'Send cancellation request confirmation to guest',
    type: 'system',
    trigger_context: 'booking_cancelled',
    context_conditions: {
      cancelled_by: 'guest'
    },
    email_template_id: TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST, // 35
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send cancellation request notification to admin',
    type: 'system',
    trigger_context: 'booking_cancelled',
    context_conditions: {
      cancelled_by: 'guest'
    },
    email_template_id: TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST_ADMIN, // 36
    recipient: 'recipient_type:info',
    priority: 5,
    enabled: true
    // NOTE: No filters for admin emails
  },

  // ============================================================
  // BOOKING AMENDED
  // ============================================================
  {
    description: 'Send booking amendment notification to guest',
    type: 'system',
    trigger_context: 'booking_amended',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.BOOKING_AMENDED, // 15
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    booking_status_filter: ['booking_confirmed', 'in_progress'],
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send booking amendment notification to admin',
    type: 'system',
    trigger_context: 'booking_amended',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.BOOKING_AMENDED_ADMIN, // 14
    recipient: 'recipient_type:info',
    priority: 5,
    enabled: true
    // NOTE: No filters for admin emails
  },

  // ============================================================
  // ICARE FUNDING UPDATES
  // ============================================================
  {
    description: 'Send iCare nights allocation notification',
    type: 'system',
    trigger_context: 'icare_funding_updated',
    context_conditions: {
      update_type: 'allocation'
    },
    email_template_id: TEMPLATE_IDS.ICARE_NIGHTS_UPDATE, // 32
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: CRITICAL safety filters for iCare
    booking_status_filter: ['booking_confirmed', 'in_progress'],
    booking_eligibility_filter: ['eligible'],
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send iCare nights no-charge cancellation notification',
    type: 'system',
    trigger_context: 'icare_funding_updated',
    context_conditions: {
      update_type: 'no_charge_cancellation'
    },
    email_template_id: TEMPLATE_IDS.ICARE_NIGHTS_UPDATE, // 32
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send iCare nights full-charge cancellation notification',
    type: 'system',
    trigger_context: 'icare_funding_updated',
    context_conditions: {
      update_type: 'full_charge_cancellation'
    },
    email_template_id: TEMPLATE_IDS.ICARE_NIGHTS_UPDATE, // 32
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },

  // ============================================================
  // COURSE MANAGEMENT
  // ============================================================
  {
    description: 'Send course EOI confirmation to guest',
    type: 'system',
    trigger_context: 'course_eoi_submitted',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.COURSE_EOI_CONFIRMATION, // 26
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    booking_eligibility_filter: ['eligible'],
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send course EOI notification to admin',
    type: 'system',
    trigger_context: 'course_eoi_submitted',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.COURSE_EOI_ADMIN, // 25
    recipient: 'recipient_type:info',
    priority: 5,
    enabled: true
    // NOTE: No filters for admin emails
  },
  {
    description: 'Send course EOI accepted notification',
    type: 'system',
    trigger_context: 'course_eoi_accepted',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.COURSE_EOI_ACCEPTED, // 24
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    booking_eligibility_filter: ['eligible'],
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send course offer notification',
    type: 'system',
    trigger_context: 'course_offer_sent',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.COURSE_OFFER_NOTIFICATION, // 27
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters
    booking_eligibility_filter: ['eligible'],
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },

  // ============================================================
  // AUTHENTICATION & ACCOUNT
  // ============================================================
  {
    description: 'Send account creation welcome email',
    type: 'system',
    trigger_context: 'account_created',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.CREATE_ACCOUNT, // 28
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters (but no eligibility check for auth emails)
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send password reset link',
    type: 'system',
    trigger_context: 'password_reset_requested',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.RESET_PASSWORD_LINK, // 33
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters (but no eligibility check for auth emails)
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
  {
    description: 'Send email confirmation link',
    type: 'system',
    trigger_context: 'email_verification_requested',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.EMAIL_CONFIRMATION_LINK, // 30
    recipient: null,
    priority: 10,
    enabled: true,
    // NEW: Safety filters (but no eligibility check for auth emails)
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },

  // ============================================================
  // GUEST PROFILE
  // ============================================================
  {
    description: 'Send guest profile update confirmation',
    type: 'system',
    trigger_context: 'guest_profile_updated',
    context_conditions: {},
    email_template_id: TEMPLATE_IDS.GUEST_PROFILE, // 31
    recipient: null,
    priority: 5,
    enabled: false, // Disabled by default - enable if needed
    // NEW: Safety filters
    guest_flag_filter: {
      exclude: ['deceased', 'banned']
    }
  },
];

/**
 * Run the migration
 */
async function migrateSystemEmailTriggers() {
  console.log('\n🚀 Starting System Email Trigger Migration\n');
  console.log(`Creating ${SYSTEM_EMAIL_TRIGGERS.length} trigger records...\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const triggerDef of SYSTEM_EMAIL_TRIGGERS) {
    try {
      // Check if template exists
      const template = await EmailTemplate.findByPk(triggerDef.email_template_id);
      if (!template) {
        console.log(`⚠️  Skipping: Template ${triggerDef.email_template_id} not found - ${triggerDef.description}`);
        skipped++;
        continue;
      }

      // Check if trigger already exists
      const existing = await EmailTrigger.findOne({
        where: {
          trigger_context: triggerDef.trigger_context,
          email_template_id: triggerDef.email_template_id,
          type: 'system',
          context_conditions: triggerDef.context_conditions
        }
      });

      if (existing) {
        // Update existing trigger with new filter fields
        await existing.update({
          booking_status_filter: triggerDef.booking_status_filter || null,
          booking_eligibility_filter: triggerDef.booking_eligibility_filter || null,
          guest_flag_filter: triggerDef.guest_flag_filter || null,
          booking_flag_filter: triggerDef.booking_flag_filter || null,
          enabled: triggerDef.enabled,
          priority: triggerDef.priority
        });
        console.log(`✓  Updated: ${triggerDef.description}`);
        created++;
        continue;
      }

      // Create the trigger
      await EmailTrigger.create(triggerDef);
      console.log(`✓  Created: ${triggerDef.description}`);
      created++;

    } catch (error) {
      console.error(`✗  Failed: ${triggerDef.description}`, error.message);
      failed++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`  ✓ Created/Updated: ${created}`);
  console.log(`  ⊘ Skipped: ${skipped}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Total: ${SYSTEM_EMAIL_TRIGGERS.length}\n`);

  if (failed === 0) {
    console.log('✅ Migration completed successfully!');
    console.log('   All system triggers now have safety filters applied.\n');
  } else {
    console.log('⚠️  Migration completed with errors. Please review failed triggers.\n');
  }
}

/**
 * Update existing triggers with filter fields
 */
async function updateExistingTriggers() {
  console.log('\n🔄 Updating existing system triggers with filter fields...\n');

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const triggerDef of SYSTEM_EMAIL_TRIGGERS) {
    try {
      const existing = await EmailTrigger.findOne({
        where: {
          trigger_context: triggerDef.trigger_context,
          email_template_id: triggerDef.email_template_id,
          type: 'system',
          context_conditions: triggerDef.context_conditions
        }
      });

      if (!existing) {
        console.log(`⊘  Skipping: Trigger not found - ${triggerDef.description}`);
        skipped++;
        continue;
      }

      // Update with new filter fields
      await existing.update({
        booking_status_filter: triggerDef.booking_status_filter || null,
        booking_eligibility_filter: triggerDef.booking_eligibility_filter || null,
        guest_flag_filter: triggerDef.guest_flag_filter || null,
        booking_flag_filter: triggerDef.booking_flag_filter || null
      });

      console.log(`✓  Updated: ${triggerDef.description}`);
      updated++;

    } catch (error) {
      console.error(`✗  Failed: ${triggerDef.description}`, error.message);
      failed++;
    }
  }

  console.log('\n📊 Update Summary:');
  console.log(`  ✓ Updated: ${updated}`);
  console.log(`  ⊘ Skipped: ${skipped}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Total: ${SYSTEM_EMAIL_TRIGGERS.length}\n`);

  if (failed === 0) {
    console.log('✅ Update completed successfully!\n');
  } else {
    console.log('⚠️  Update completed with errors. Please review failed triggers.\n');
  }
}

/**
 * Rollback the migration (delete created triggers)
 */
async function rollbackMigration() {
  console.log('\n⏪ Rolling back System Email Trigger Migration\n');

  const deleted = await EmailTrigger.destroy({
    where: {
      type: 'system',
      trigger_context: {
        [Op.in]: SYSTEM_EMAIL_TRIGGERS.map(t => t.trigger_context)
      }
    }
  });

  console.log(`🗑️  Deleted ${deleted} system trigger(s)\n`);
  console.log('✅ Rollback completed!\n');
}

// Run migration if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const isRollback = args.includes('--rollback');
  const isUpdate = args.includes('--update');

  if (isRollback) {
    rollbackMigration()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Migration rollback failed:', error);
        process.exit(1);
      });
  } else if (isUpdate) {
    updateExistingTriggers()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Update failed:', error);
        process.exit(1);
      });
  } else {
    migrateSystemEmailTriggers()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  migrateSystemEmailTriggers,
  updateExistingTriggers,
  rollbackMigration,
  SYSTEM_EMAIL_TRIGGERS
};