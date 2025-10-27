'use strict';

const { EmailTrigger, EmailTriggerQuestion, Question } = require('../models');

/**
 * Migration script to convert existing email trigger JSON questions to relational format
 * This script will:
 * 1. Find all email triggers with JSON trigger_questions data
 * 2. Extract question information from JSON
 * 3. Match questions by question_key to get question IDs
 * 4. Create EmailTriggerQuestion records linking triggers to questions
 * 5. Preserve the selected answers
 */
async function migrateEmailTriggerQuestions() {
  try {
    console.log('\n========================================');
    console.log('Email Trigger Questions Migration Script');
    console.log('========================================\n');

    // Get all existing email triggers with JSON trigger_questions
    const triggers = await EmailTrigger.findAll({
      where: {
        trigger_questions: {
          [require('sequelize').Op.not]: null
        }
      }
    });

    console.log(`📊 Found ${triggers.length} triggers to migrate\n`);

    if (triggers.length === 0) {
      console.log('✅ No triggers need migration. All done!');
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let totalQuestionsCreated = 0;

    for (const trigger of triggers) {
      try {
        const triggerQuestions = trigger.trigger_questions || [];
        
        console.log(`\n🔄 Processing trigger #${trigger.id}:`);
        console.log(`   Recipient: ${trigger.recipient}`);
        console.log(`   Questions in JSON: ${triggerQuestions.length}`);

        if (triggerQuestions.length === 0) {
          console.log(`   ⏭️  No questions to migrate, skipping...`);
          skipCount++;
          continue;
        }

        // Check if this trigger already has relational questions
        const existingRelationalQuestions = await EmailTriggerQuestion.count({
          where: { email_trigger_id: trigger.id }
        });

        if (existingRelationalQuestions > 0) {
          console.log(`   ⚠️  Already has ${existingRelationalQuestions} relational question(s), skipping...`);
          skipCount++;
          continue;
        }

        let questionsCreated = 0;
        let questionsFailed = 0;

        for (const tq of triggerQuestions) {
          try {
            const questionKey = tq.question_key;
            const answer = tq.answer;

            if (!questionKey) {
              console.log(`   ⚠️  Question missing question_key, skipping...`);
              questionsFailed++;
              continue;
            }

            // Find the question by question_key
            const question = await Question.findOne({
              where: { question_key: questionKey }
            });

            if (!question) {
              console.log(`   ❌ Question not found for key: ${questionKey}`);
              questionsFailed++;
              continue;
            }

            // Create the relational record
            await EmailTriggerQuestion.create({
              email_trigger_id: trigger.id,
              question_id: question.id,
              answer: answer || null
            });

            console.log(`   ✅ Linked question: ${question.question} (ID: ${question.id})`);
            questionsCreated++;
            totalQuestionsCreated++;

          } catch (error) {
            console.error(`   ❌ Error migrating question:`, error.message);
            questionsFailed++;
          }
        }

        if (questionsFailed === 0 && questionsCreated > 0) {
          console.log(`   ✨ Successfully migrated ${questionsCreated} question(s) for trigger #${trigger.id}`);
          successCount++;
        } else if (questionsFailed > 0 && questionsCreated > 0) {
          console.log(`   ⚠️  Partially migrated trigger #${trigger.id}: ${questionsCreated} success, ${questionsFailed} failed`);
          successCount++;
        } else {
          console.log(`   ❌ Failed to migrate any questions for trigger #${trigger.id}`);
          errorCount++;
        }

      } catch (error) {
        console.error(`   ❌ Error migrating trigger #${trigger.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total triggers processed: ${triggers.length}`);
    console.log(`🔗 Total questions linked: ${totalQuestionsCreated}`);
    console.log('========================================\n');

    if (errorCount > 0) {
      console.log('⚠️  Some triggers failed to migrate. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('🎉 Migration completed successfully!');
      console.log('\n💡 Note: The old JSON trigger_questions field is preserved for reference.');
      console.log('   You can remove it in a future migration once you verify everything works.\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateEmailTriggerQuestions()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateEmailTriggerQuestions;