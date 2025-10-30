'use strict';

const { EmailTrigger, EmailTriggerQuestion, Question, Section, Page, Template, Setting } = require('../models');

/**
 * FIXED Migration script to convert existing email trigger JSON questions to relational format
 * 
 * ✨ FIX: Now uses default_template from settings to ensure questions are matched from the correct template
 * 
 * This script will:
 * 1. Get the default template ID from settings
 * 2. Find all email triggers with JSON trigger_questions data
 * 3. Extract question information from JSON
 * 4. Match questions by question_key ONLY from the default template
 * 5. Create EmailTriggerQuestion records linking triggers to questions
 * 6. Preserve the selected answers
 */
async function migrateEmailTriggerQuestions() {
  try {
    console.log('\n========================================');
    console.log('Email Trigger Questions Migration Script');
    console.log('(FIXED: Using default_template from settings)');
    console.log('========================================\n');

    // ✨ STEP 1: Get default template ID from settings
    console.log('📋 Step 1: Getting default template from settings...');
    const defaultTemplateSetting = await Setting.findOne({
      where: { attribute: 'default_template' }
    });

    if (!defaultTemplateSetting || !defaultTemplateSetting.value) {
      console.error('❌ Default template not found in settings table!');
      console.error('   Please set the default_template in your settings first.');
      process.exit(1);
    }

    const defaultTemplateId = defaultTemplateSetting.value;
    console.log(`   ✅ Default template ID: ${defaultTemplateId}\n`);

    // Verify the template exists
    const defaultTemplate = await Template.findOne({
      where: { id: defaultTemplateId },
      include: [{
        model: Page,
        include: [{
          model: Section,
          include: [Question]
        }]
      }]
    });

    if (!defaultTemplate) {
      console.error(`❌ Template with ID ${defaultTemplateId} not found!`);
      process.exit(1);
    }

    console.log(`   ✅ Template found: ${defaultTemplate.name}`);
    // console.log(`   Pages: ${defaultTemplate.Pages?.length || 0}`);
    
    // Count total questions in default template
    let totalQuestionsInTemplate = 0;
    defaultTemplate.Pages?.forEach(page => {
      page.Sections?.forEach(section => {
        totalQuestionsInTemplate += section.Questions?.length || 0;
      });
    });
    console.log(`   Questions: ${totalQuestionsInTemplate}\n`);

    // ✨ STEP 2: Get all question IDs from the default template for validation
    const defaultTemplateQuestionIds = new Set();
    const questionKeyToId = new Map(); // Map question_key to question_id
    
    defaultTemplate.Pages?.forEach(page => {
      page.Sections?.forEach(section => {
        section.Questions?.forEach(question => {
          defaultTemplateQuestionIds.add(question.id);
          if (question.question_key) {
            questionKeyToId.set(question.question_key, question.id);
          }
        });
      });
    });

    console.log(`📊 Indexed ${questionKeyToId.size} questions from default template by question_key\n`);

    // ✨ STEP 3: Get all existing email triggers with JSON trigger_questions
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
    let questionsNotInDefaultTemplate = 0;

    for (const trigger of triggers) {
      try {
        const triggerQuestions = trigger.trigger_questions || [];
        
        console.log(`\n🔄 Processing trigger #${trigger.id}:`);
        console.log(`   Type: ${trigger.type}`);
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

            // ✨ FIX: Use the pre-indexed map to get question ID from default template
            const questionId = questionKeyToId.get(questionKey);

            if (!questionId) {
              console.log(`   ❌ Question not found in default template for key: ${questionKey}`);
              questionsFailed++;
              questionsNotInDefaultTemplate++;
              continue;
            }

            // Get the full question object for logging
            const question = await Question.findByPk(questionId);

            if (!question) {
              console.log(`   ❌ Question ID ${questionId} not found (this shouldn't happen)`);
              questionsFailed++;
              continue;
            }

            // Verify this question is actually in the default template (extra safety check)
            if (!defaultTemplateQuestionIds.has(question.id)) {
              console.log(`   ⚠️  Question ${question.id} is not in default template, skipping...`);
              questionsFailed++;
              questionsNotInDefaultTemplate++;
              continue;
            }

            // Create the relational record
            await EmailTriggerQuestion.create({
              email_trigger_id: trigger.id,
              question_id: question.id,
              answer: answer || null
            });

            console.log(`   ✅ Linked question: ${question.question} (ID: ${question.id}, Key: ${questionKey})`);
            if (answer) {
              console.log(`      Expected answer: "${answer}"`);
            }
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
    console.log(`⏭️  Skipped (already migrated): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total triggers processed: ${triggers.length}`);
    console.log(`🔗 Total questions linked: ${totalQuestionsCreated}`);
    console.log(`⚠️  Questions not in default template: ${questionsNotInDefaultTemplate}`);
    console.log('========================================\n');

    if (questionsNotInDefaultTemplate > 0) {
      console.log('⚠️  WARNING: Some questions were not found in the default template.');
      console.log('   This likely means:');
      console.log('   1. The question_key exists in a different template');
      console.log('   2. The question was deleted from the default template');
      console.log('   3. The question_key is incorrect\n');
    }

    if (errorCount > 0) {
      console.log('⚠️  Some triggers failed to migrate. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('🎉 Migration completed successfully!');
      console.log('\n💡 Next steps:');
      console.log('   1. Test the email triggers to verify they work correctly');
      console.log('   2. Check the email_trigger_questions table to confirm links');
      console.log('   3. The old JSON trigger_questions field is preserved for reference');
      console.log('   4. Once verified, you can remove the JSON field in a future migration\n');
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