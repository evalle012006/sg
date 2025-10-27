'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('\n========================================');
    console.log('Email Trigger Questions Migration Seeder');
    console.log('========================================\n');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Step 1: Get all email triggers with JSON trigger_questions
      const [existingTriggers] = await queryInterface.sequelize.query(
        `SELECT id, trigger_questions, recipient
         FROM email_triggers 
         WHERE trigger_questions IS NOT NULL 
           AND JSON_LENGTH(trigger_questions) > 0
         ORDER BY id`,
        { transaction }
      );

      if (existingTriggers.length === 0) {
        console.log('✅ No email triggers need migration');
        await transaction.commit();
        return;
      }

      console.log(`📊 Found ${existingTriggers.length} trigger(s) to migrate\n`);

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let totalQuestionsCreated = 0;

      // Step 2: Process each trigger
      for (const trigger of existingTriggers) {
        try {
          const triggerId = trigger.id;
          const recipient = trigger.recipient;
          
          // Parse the JSON trigger_questions
          let triggerQuestions;
          try {
            triggerQuestions = typeof trigger.trigger_questions === 'string' 
              ? JSON.parse(trigger.trigger_questions)
              : trigger.trigger_questions;
          } catch (e) {
            console.error(`   ❌ Failed to parse JSON for trigger #${triggerId}`);
            errorCount++;
            continue;
          }

          console.log(`\n🔄 Processing trigger #${triggerId}:`);
          console.log(`   Recipient: ${recipient}`);
          console.log(`   Questions in JSON: ${triggerQuestions.length}`);

          if (!Array.isArray(triggerQuestions) || triggerQuestions.length === 0) {
            console.log(`   ⏭️  No questions to migrate, skipping...`);
            skippedCount++;
            continue;
          }

          // Check if this trigger already has relational questions
          const [existingCount] = await queryInterface.sequelize.query(
            `SELECT COUNT(*) as count 
             FROM email_trigger_questions 
             WHERE email_trigger_id = :triggerId`,
            {
              replacements: { triggerId },
              type: Sequelize.QueryTypes.SELECT,
              transaction
            }
          );

          if (existingCount.count > 0) {
            console.log(`   ⚠️  Already has ${existingCount.count} relational question(s), skipping...`);
            skippedCount++;
            continue;
          }

          let questionsCreated = 0;
          let questionsFailed = 0;

          // Process each question in the JSON array
          for (const tq of triggerQuestions) {
            try {
              const questionKey = tq.question_key;
              const answer = tq.answer || null;

              if (!questionKey) {
                console.log(`   ⚠️  Question missing question_key, skipping...`);
                questionsFailed++;
                continue;
              }

              // Find the question by question_key
              const [question] = await queryInterface.sequelize.query(
                `SELECT id, question FROM questions WHERE question_key = :questionKey LIMIT 1`,
                {
                  replacements: { questionKey },
                  type: Sequelize.QueryTypes.SELECT,
                  transaction
                }
              );

              if (!question) {
                console.log(`   ❌ Question not found for key: ${questionKey}`);
                questionsFailed++;
                continue;
              }

              // Create the relational record
              await queryInterface.sequelize.query(
                `INSERT INTO email_trigger_questions 
                 (email_trigger_id, question_id, answer, created_at, updated_at)
                 VALUES (:triggerId, :questionId, :answer, NOW(), NOW())`,
                {
                  replacements: {
                    triggerId: triggerId,
                    questionId: question.id,
                    answer: answer
                  },
                  transaction
                }
              );

              console.log(`   ✅ Linked question: ${question.question} (ID: ${question.id})`);
              questionsCreated++;
              totalQuestionsCreated++;

            } catch (error) {
              console.error(`   ❌ Error migrating question:`, error.message);
              questionsFailed++;
            }
          }

          if (questionsFailed === 0 && questionsCreated > 0) {
            console.log(`   ✨ Successfully migrated ${questionsCreated} question(s) for trigger #${triggerId}`);
            successCount++;
          } else if (questionsFailed > 0 && questionsCreated > 0) {
            console.log(`   ⚠️  Partially migrated trigger #${triggerId}: ${questionsCreated} success, ${questionsFailed} failed`);
            successCount++;
          } else {
            console.log(`   ❌ Failed to migrate any questions for trigger #${triggerId}`);
            errorCount++;
          }

        } catch (error) {
          console.error(`   ❌ Error processing trigger:`, error.message);
          errorCount++;
        }
      }

      console.log('\n========================================');
      console.log('Step 1 Summary: Question Migration');
      console.log('========================================');
      console.log(`✅ Successfully migrated: ${successCount}`);
      console.log(`⏭️  Skipped: ${skippedCount}`);
      console.log(`❌ Errors: ${errorCount}`);
      console.log(`🔗 Total questions created: ${totalQuestionsCreated}`);
      console.log('========================================\n');

      // Step 3: Verify migration
      const [verificationResults] = await queryInterface.sequelize.query(
        `SELECT 
          COUNT(DISTINCT et.id) as total_triggers,
          COUNT(DISTINCT etq.email_trigger_id) as triggers_with_relations,
          COUNT(etq.id) as total_question_links
         FROM email_triggers et
         LEFT JOIN email_trigger_questions etq ON et.id = etq.email_trigger_id
         WHERE et.trigger_questions IS NOT NULL 
           AND JSON_LENGTH(et.trigger_questions) > 0`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      const stats = verificationResults;

      console.log('========================================');
      console.log('Final Migration Summary');
      console.log('========================================');
      console.log(`📊 Total triggers with JSON questions: ${stats.total_triggers}`);
      console.log(`✅ Triggers with relational questions: ${stats.triggers_with_relations}`);
      console.log(`🔗 Total question links created: ${stats.total_question_links}`);
      console.log(`📈 Migration progress: ${Math.round((stats.triggers_with_relations / stats.total_triggers) * 100)}%`);
      console.log('========================================\n');

      if (errorCount > 0) {
        console.log('⚠️  Warning: Some triggers had errors during migration.');
        console.log('    Check the logs above for details.\n');
      } else {
        console.log('🎉 All email trigger questions successfully migrated!\n');
      }

      console.log('💡 Note: The old JSON trigger_questions field is preserved for reference.');
      console.log('   You can remove it in a future migration once verified.\n');

      // Commit transaction
      await transaction.commit();
      console.log('✅ Migration seeder completed successfully!\n');

    } catch (error) {
      await transaction.rollback();
      console.error('\n❌ Migration seeder failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('\n========================================');
    console.log('Reverting Email Trigger Questions Migration');
    console.log('========================================\n');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Get count before deletion
      const [beforeCount] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM email_trigger_questions`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      console.log(`🗑️  Deleting ${beforeCount.count} email trigger question link(s)...\n`);

      // Delete all email_trigger_questions records
      await queryInterface.sequelize.query(
        `DELETE FROM email_trigger_questions`,
        { transaction }
      );

      console.log(`   ✅ Deleted all email trigger question links`);

      // Verify deletion
      const [afterCount] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM email_trigger_questions`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      console.log(`   📊 Remaining records: ${afterCount.count}`);

      await transaction.commit();
      
      console.log('\n✅ Migration rollback completed successfully!');
      console.log('💡 The JSON trigger_questions field data is preserved.\n');

    } catch (error) {
      await transaction.rollback();
      console.error('\n❌ Rollback failed:', error);
      throw error;
    }
  }
};