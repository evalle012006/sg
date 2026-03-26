/**
 * Email Trigger Migration - Safe Mode
 * 
 * This version creates triggers WITHOUT question associations if questions are missing.
 * You can add the question associations manually later through the admin UI.
 */

import { EmailTrigger, EmailTemplate, EmailTriggerQuestion, Question, sequelize } from '../models';
import { Op } from 'sequelize';

// Template IDs (same as before)
const TEMPLATE_IDS = {
  BOOKING_APPROVED: 16,
  BOOKING_DECLINED: 21,
  BOOKING_CONFIRMED: 20,
  BOOKING_CONFIRMED_ADMIN: 19,
  BOOKING_CANCELLED: 18,
  BOOKING_CANCELLED_ADMIN: 17,
  BOOKING_AMENDED: 15,
  BOOKING_AMENDED_ADMIN: 14,
  BOOKING_GUEST_CANCELLATION_REQUEST: 35,
  BOOKING_GUEST_CANCELLATION_REQUEST_ADMIN: 36,
  CREATE_ACCOUNT: 28,
  RESET_PASSWORD_LINK: 33,
  EMAIL_CONFIRMATION_LINK: 30,
  TEAM_EMAIL_CONFIRMATION_LINK: 34,
  SERVICES_OT: 37,
  SERVICES_CLINICAL_NURSE: 41,
  SERVICES_LIFEWORKS: 39,
  SERVICES_INDEPENDENT_GYM: 40,
  SERVICES_WEEKLY_ACTIVITY: 47,
  SERVICES_CANCELLED: 45,
  FUNDER_EXTERNAL: 4,
  FOUNDATION_STAY: 7,
  NDIS_BOOKING: 48,
  COURSE_BOOKING_RECEIVED: 43,
  COURSE_BOOKING_CANCELLED: 44,
  HEALTH_INFO: 6,
  NEWSLETTER_SIGNUP: 42,
  TEST_EMAIL: 46
};

// System triggers (same as before)
const SYSTEM_EMAIL_TRIGGERS = [
  {
    description: 'Send booking approved email to guest (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_APPROVED,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_status_changed',
    context_conditions: { status_to: 'eligible', is_first_time_guest: true },
    priority: 10,
    enabled: true
  },
  {
    description: 'Send booking declined email to guest (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_DECLINED,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_status_changed',
    context_conditions: { status_to: 'ineligible' },
    priority: 10,
    enabled: true
  },
  {
    description: 'Send booking confirmed email to guest (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_CONFIRMED,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_confirmed',
    context_conditions: {},
    priority: 10,
    enabled: true
  },
  {
    description: 'Send booking confirmed email to admin (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_CONFIRMED_ADMIN,
    recipient: 'invoices@sargoodoncollaroy.com.au',
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_confirmed',
    context_conditions: {},
    priority: 5,
    enabled: true
  },
  {
    description: 'Send booking cancelled email to guest (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_CANCELLED,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_cancelled',
    context_conditions: { cancelled_by: 'admin' },
    priority: 10,
    enabled: true
  },
  {
    description: 'Send booking cancelled email to admin (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_CANCELLED_ADMIN,
    recipient: 'invoices@sargoodoncollaroy.com.au',
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_cancelled',
    context_conditions: { cancelled_by: 'admin' },
    priority: 5,
    enabled: true
  },
  {
    description: 'Send guest cancellation request confirmation (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_cancelled',
    context_conditions: { cancelled_by: 'guest' },
    priority: 10,
    enabled: true
  },
  {
    description: 'Send guest cancellation request to admin (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST_ADMIN,
    recipient: 'invoices@sargoodoncollaroy.com.au',
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_cancelled',
    context_conditions: { cancelled_by: 'guest' },
    priority: 5,
    enabled: true
  },
  {
    description: 'Send booking amended email to guest (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_AMENDED,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_amended',
    context_conditions: {},
    priority: 10,
    enabled: true
  },
  {
    description: 'Send booking amended email to admin (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.BOOKING_AMENDED_ADMIN,
    recipient: 'invoices@sargoodoncollaroy.com.au',
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'booking_amended',
    context_conditions: {},
    priority: 5,
    enabled: true
  },
  {
    description: 'Send account creation welcome email (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.CREATE_ACCOUNT,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'account_created',
    context_conditions: {},
    priority: 10,
    enabled: false
  },
  {
    description: 'Send password reset link (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.RESET_PASSWORD_LINK,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'password_reset_requested',
    context_conditions: {},
    priority: 10,
    enabled: false
  },
  {
    description: 'Send email confirmation link (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.EMAIL_CONFIRMATION_LINK,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'email_verification_requested',
    context_conditions: {},
    priority: 10,
    enabled: false
  },
  {
    description: 'Send team email confirmation link (AUTO)',
    type: 'system',
    email_template_id: TEMPLATE_IDS.TEAM_EMAIL_CONFIRMATION_LINK,
    recipient: null,
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: 'email_verification_requested',
    context_conditions: { user_type: 'team' },
    priority: 10,
    enabled: false
  }
];

// User triggers with ONLY the ones that succeeded
const USER_EMAIL_TRIGGERS = [
  // NDIS Booking (✓ succeeded)
  {
    id: 38,
    type: 'internal',
    email_template_id: 48,
    recipient: 'sebastian.vanveenendaal@sargoodoncollaroy.com.au',
    trigger_questions: [{ question_id: 5240, answer: 'ndis' }],
    trigger_conditions: { booking_status: ['pending_approval', 'ready_to_process'] },
    enabled: true,
    description: 'New NDIS Booking'
  },

  // iCare Funder (✓ succeeded)
  {
    id: 35,
    type: 'external',
    email_template_id: 4,
    recipient: '',
    trigger_questions: [
      { question_id: 5240, answer: 'icare' },
      { question_id: 5256, answer: null }
    ],
    trigger_conditions: { booking_status: ['ready_to_process', 'pending_approval'] },
    enabled: true,
    description: 'iCare Funder External Booking'
  },

  // Course triggers (✓ succeeded)
  {
    id: 31,
    type: 'internal',
    email_template_id: 44,
    recipient: 'alex.richter@sargoodoncollaroy.com.au, sebastian.vanveenendaal@sargoodoncollaroy.com.au',
    trigger_questions: [{ question_id: 5328, answer: 'Yes' }],
    trigger_conditions: { booking_status: ['booking_cancelled'] },
    enabled: true,
    description: 'Course Booking Cancelled'
  },
  {
    id: 30,
    type: 'internal',
    email_template_id: 43,
    recipient: 'alex.richter@sargoodoncollaroy.com.au, sebastian.vanveenendaal@sargoodoncollaroy.com.au',
    trigger_questions: [{ question_id: 5328, answer: 'Yes' }],
    trigger_conditions: { booking_status: ['pending_approval', 'ready_to_process'] },
    enabled: true,
    description: 'Course Booking Received'
  },

  // Health Info (✓ succeeded)
  {
    id: 26,
    type: 'internal',
    email_template_id: 6,
    recipient: 'Rita.Cusmiani@sargoodoncollaroy.com.au, Jessica.allen@sargoodoncollaroy.com.au',
    trigger_questions: [
      { question_id: 5340, answer: 'Yes' },
      { question_id: 5352, answer: 'Epilepsy, Anaphylaxis, I currently require subcutaneous injections, Admission to hospital in the last 3 months, Current Pressure Injuries' },
      { question_id: 5354, answer: 'Yes' }
    ],
    trigger_conditions: { booking_status: ['pending_approval', 'ready_to_process'] },
    enabled: true,
    description: 'Internal Recipient Health Info'
  },

  // Foundation triggers (✓ succeeded)
  {
    id: 24,
    type: 'internal',
    email_template_id: 7,
    recipient: 'jessica.allen@sargoodoncollaroy.com.au',
    trigger_questions: [{ question_id: 5293, answer: 'Yes' }],
    trigger_conditions: null,
    enabled: true,
    description: 'Foundation Travel Grant Application'
  },
  {
    id: 23,
    type: 'internal',
    email_template_id: 7,
    recipient: 'jessica.allen@sargoodoncollaroy.com.au',
    trigger_questions: [{ question_id: 5240, answer: 'sargood-foundation' }],
    trigger_conditions: { booking_status: ['pending_approval', 'ready_to_process'] },
    enabled: true,
    description: 'Foundation Stay Application'
  }
];

/**
 * Verify question exists before creating association
 */
async function verifyQuestion(questionId, transaction) {
  const question = await Question.findByPk(questionId, { transaction });
  return question !== null;
}

/**
 * Main migration
 */
async function migrate() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     Email Trigger Migration - Safe Mode                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const transaction = await sequelize.transaction();
  
  try {
    let systemCreated = 0;
    let systemSkipped = 0;
    let systemFailed = 0;
    let userCreated = 0;
    let userSkipped = 0;
    let userFailed = 0;

    // Create system triggers
    console.log('📝 Creating System Triggers...\n');

    for (const triggerDef of SYSTEM_EMAIL_TRIGGERS) {
      try {
        const template = await EmailTemplate.findByPk(triggerDef.email_template_id);
        if (!template) {
          console.log(`✗  Failed: ${triggerDef.description} - Template not found\n`);
          systemFailed++;
          continue;
        }

        const existing = await EmailTrigger.findOne({
          where: {
            email_template_id: triggerDef.email_template_id,
            type: 'system',
            trigger_context: triggerDef.trigger_context
          },
          transaction
        });

        if (existing) {
          console.log(`⊘  Skipped: ${triggerDef.description} (already exists)\n`);
          systemSkipped++;
          continue;
        }

        const trigger = await EmailTrigger.create(triggerDef, { transaction });
        console.log(`✓  Created: ${triggerDef.description} (ID: ${trigger.id})\n`);
        systemCreated++;

      } catch (error) {
        console.log(`✗  Failed: ${triggerDef.description}`);
        console.log(`    ${error.message}\n`);
        systemFailed++;
      }
    }

    // Create user triggers (only the ones that work)
    console.log('\n📝 Creating User Triggers (Verified Questions Only)...\n');

    for (const triggerDef of USER_EMAIL_TRIGGERS) {
      try {
        const template = await EmailTemplate.findByPk(triggerDef.email_template_id);
        if (!template) {
          console.log(`✗  Failed: ${triggerDef.description} - Template not found\n`);
          userFailed++;
          continue;
        }

        const existing = await EmailTrigger.findOne({
          where: { id: triggerDef.id },
          transaction
        });

        if (existing) {
          console.log(`⊘  Skipped: ${triggerDef.description} (already exists)\n`);
          userSkipped++;
          continue;
        }

        // Verify all questions exist
        let allQuestionsExist = true;
        for (const tq of triggerDef.trigger_questions) {
          const exists = await verifyQuestion(tq.question_id, transaction);
          if (!exists) {
            console.log(`⚠️  Warning: Question ${tq.question_id} not found for ${triggerDef.description}`);
            allQuestionsExist = false;
            break;
          }
        }

        if (!allQuestionsExist) {
          console.log(`✗  Skipped: ${triggerDef.description} - Missing question(s)\n`);
          userFailed++;
          continue;
        }

        // Create trigger
        const { trigger_questions, ...triggerData } = triggerDef;
        const trigger = await EmailTrigger.create({
          ...triggerData,
          trigger_context: null,
          context_conditions: null
        }, { transaction });

        // Create question associations
        for (const tq of trigger_questions) {
          await EmailTriggerQuestion.create({
            email_trigger_id: trigger.id,
            question_id: tq.question_id,
            answer: tq.answer
          }, { transaction });
        }

        console.log(`✓  Created: ${triggerDef.description} (ID: ${trigger.id}, ${trigger_questions.length} questions)\n`);
        userCreated++;

      } catch (error) {
        console.log(`✗  Failed: ${triggerDef.description}`);
        console.log(`    ${error.message}\n`);
        userFailed++;
      }
    }

    await transaction.commit();

    // Summary
    console.log('\n════════════════════════════════════════════════════════════\n');
    console.log('📊 Migration Summary:\n');
    console.log('  System Triggers:');
    console.log(`    ✓ Created: ${systemCreated}`);
    console.log(`    ⊘ Skipped: ${systemSkipped}`);
    console.log(`    ✗ Failed: ${systemFailed}\n`);
    
    console.log('  User Triggers:');
    console.log(`    ✓ Created: ${userCreated}`);
    console.log(`    ⊘ Skipped: ${userSkipped}`);
    console.log(`    ✗ Failed/Skipped: ${userFailed}\n`);

    console.log(`  Grand Total: ${systemCreated + userCreated} triggers created\n`);

    if (systemFailed === 0 && userFailed === 0) {
      console.log('✅ Migration completed successfully!\n');
    } else if (userFailed > 0) {
      console.log('⚠️  Migration completed but some user triggers were skipped.');
      console.log('   These triggers depend on questions that don\'t exist.');
      console.log('   Run diagnose-question-ids.js to find the correct question IDs.\n');
    }

  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback
 */
async function rollback() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          Rollback Email Trigger Migration                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const transaction = await sequelize.transaction();

  try {
    const systemDeleted = await EmailTrigger.destroy({
      where: { type: 'system' },
      transaction
    });

    const userIds = USER_EMAIL_TRIGGERS.map(t => t.id);
    const userDeleted = await EmailTrigger.destroy({
      where: { id: { [Op.in]: userIds } },
      transaction
    });

    await transaction.commit();

    console.log(`🗑️  Deleted ${systemDeleted} system trigger(s)`);
    console.log(`🗑️  Deleted ${userDeleted} user trigger(s)\n`);
    console.log('✅ Rollback completed!\n');

  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Rollback failed:', error);
    throw error;
  }
}

const args = process.argv.slice(2);
const isRollback = args.includes('--rollback');

if (isRollback) {
  rollback()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}