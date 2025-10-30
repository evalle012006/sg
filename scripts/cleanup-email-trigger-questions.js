'use strict';

const { EmailTrigger, EmailTriggerQuestion, Question, Section, Page, Template, Setting } = require('../models');

/**
 * Cleanup script for Email Trigger Questions
 * 
 * This script will:
 * 1. Get the default template ID from settings
 * 2. Find all EmailTriggerQuestion records
 * 3. Check if the linked question is from the default template
 * 4. Delete links to questions from other templates
 * 5. Preserve links to questions from the default template
 * 
 * Use this BEFORE re-running the migration to clean up incorrect links
 */
async function cleanupEmailTriggerQuestions() {
  try {
    console.log('\n========================================');
    console.log('Email Trigger Questions Cleanup Script');
    console.log('========================================\n');

    console.log('⚠️  WARNING: This will delete EmailTriggerQuestion records that link to questions');
    console.log('   from templates other than the default template.\n');

    // Get default template
    const defaultTemplateSetting = await Setting.findOne({
      where: { attribute: 'default_template' }
    });

    if (!defaultTemplateSetting || !defaultTemplateSetting.value) {
      console.error('❌ Default template not found in settings table!');
      process.exit(1);
    }

    const defaultTemplateId = defaultTemplateSetting.value;
    console.log(`📋 Default template ID: ${defaultTemplateId}\n`);

    // Get default template with all questions
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

    console.log(`✅ Default template: ${defaultTemplate.name}\n`);

    // Build set of valid question IDs from default template
    const validQuestionIds = new Set();
    defaultTemplate.Pages?.forEach(page => {
      page.Sections?.forEach(section => {
        section.Questions?.forEach(question => {
          validQuestionIds.add(question.id);
        });
      });
    });

    console.log(`📊 Found ${validQuestionIds.size} questions in default template\n`);

    // Get all EmailTriggerQuestion records
    const allTriggerQuestions = await EmailTriggerQuestion.findAll({
      include: [
        {
          model: EmailTrigger,
          as: 'emailTrigger'
        },
        {
          model: Question,
          as: 'question',
          include: [
            {
              model: Section,
              include: [
                {
                  model: Page,
                  include: [Template]
                }
              ]
            }
          ]
        }
      ]
    });

    console.log(`📊 Found ${allTriggerQuestions.length} EmailTriggerQuestion records to check\n`);

    if (allTriggerQuestions.length === 0) {
      console.log('✅ No records to clean up!');
      return;
    }

    let validCount = 0;
    let invalidCount = 0;
    const toDelete = [];

    console.log('🔍 Analyzing records...\n');

    for (const tq of allTriggerQuestions) {
      const triggerId = tq.email_trigger_id;
      const questionId = tq.question_id;
      const question = tq.question;

      if (!question) {
        console.log(`⚠️  Trigger #${triggerId}: Question ID ${questionId} not found - will delete`);
        toDelete.push(tq);
        invalidCount++;
        continue;
      }

      // Check if question is in default template
      if (validQuestionIds.has(questionId)) {
        console.log(`✅ Trigger #${triggerId}: Question "${question.question}" (ID: ${questionId}) - VALID`);
        validCount++;
      } else {
        // Get the template this question belongs to
        const templateId = question.Section?.Page?.Template?.id;
        const templateName = question.Section?.Page?.Template?.name;
        
        console.log(`❌ Trigger #${triggerId}: Question "${question.question}" (ID: ${questionId})`);
        console.log(`   From template: "${templateName || 'Unknown'}" (ID: ${templateId || 'Unknown'})`);
        console.log(`   This is NOT in the default template - will delete`);
        
        toDelete.push(tq);
        invalidCount++;
      }
    }

    console.log('\n========================================');
    console.log('Analysis Summary');
    console.log('========================================');
    console.log(`✅ Valid records (in default template): ${validCount}`);
    console.log(`❌ Invalid records (not in default template): ${invalidCount}`);
    console.log(`📊 Total records: ${allTriggerQuestions.length}`);
    console.log('========================================\n');

    if (toDelete.length === 0) {
      console.log('🎉 All records are valid! No cleanup needed.\n');
      return;
    }

    console.log(`⚠️  About to delete ${toDelete.length} invalid records...\n`);
    console.log('Press Ctrl+C now to cancel, or wait 5 seconds to continue...\n');

    // Wait 5 seconds before deleting
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Deleting invalid records...\n');

    let deleteCount = 0;
    for (const tq of toDelete) {
      try {
        await tq.destroy();
        deleteCount++;
        console.log(`   ✅ Deleted EmailTriggerQuestion ID ${tq.id} (Trigger #${tq.email_trigger_id}, Question #${tq.question_id})`);
      } catch (error) {
        console.error(`   ❌ Failed to delete EmailTriggerQuestion ID ${tq.id}:`, error.message);
      }
    }

    console.log('\n========================================');
    console.log('Cleanup Summary');
    console.log('========================================');
    console.log(`🗑️  Records deleted: ${deleteCount}`);
    console.log(`✅ Valid records preserved: ${validCount}`);
    console.log('========================================\n');

    if (deleteCount > 0) {
      console.log('✅ Cleanup completed successfully!');
      console.log('\n💡 Next steps:');
      console.log('   1. Review the deleted records above');
      console.log('   2. Re-run the migration script to create correct links');
      console.log('   3. Verify the email triggers work correctly\n');
    }

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    throw error;
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupEmailTriggerQuestions()
    .then(() => {
      console.log('\n✅ Cleanup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupEmailTriggerQuestions;