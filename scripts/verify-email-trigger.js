'use strict';

const { EmailTrigger, EmailTriggerQuestion, Question, Section, Page, Template, Setting } = require('../models');

/**
 * Verification script for Email Trigger Questions
 * 
 * This script checks the current state of EmailTriggerQuestion records
 * and reports any issues with template mismatches
 */
async function verifyEmailTriggerQuestions() {
  try {
    console.log('\n========================================');
    console.log('Email Trigger Questions Verification');
    console.log('========================================\n');

    // Get default template
    const defaultTemplateSetting = await Setting.findOne({
      where: { attribute: 'default_template' }
    });

    if (!defaultTemplateSetting || !defaultTemplateSetting.value) {
      console.error('❌ CRITICAL: Default template not found in settings table!');
      console.error('   Your email triggers will not work correctly.');
      console.error('   Please set default_template in settings first.\n');
      process.exit(1);
    }

    const defaultTemplateId = defaultTemplateSetting.value;
    console.log(`📋 Default Template ID: ${defaultTemplateId}`);

    // Get default template
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
      console.error(`❌ CRITICAL: Template with ID ${defaultTemplateId} not found!`);
      process.exit(1);
    }

    console.log(`📋 Default Template Name: "${defaultTemplate.name}"`);
    console.log(`📋 Pages in template: ${defaultTemplate.Pages?.length || 0}`);

    // Build set of valid question IDs
    const validQuestionIds = new Set();
    const questionIdToInfo = new Map();
    
    defaultTemplate.Pages?.forEach(page => {
      page.Sections?.forEach(section => {
        section.Questions?.forEach(question => {
          validQuestionIds.add(question.id);
          questionIdToInfo.set(question.id, {
            question: question.question,
            question_key: question.question_key,
            section: section.label,
            page: page.title
          });
        });
      });
    });

    console.log(`📋 Questions in default template: ${validQuestionIds.size}\n`);

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

    console.log(`📊 Total EmailTriggerQuestion records: ${allTriggerQuestions.length}\n`);

    if (allTriggerQuestions.length === 0) {
      console.log('⚠️  No EmailTriggerQuestion records found.');
      console.log('   Either:');
      console.log('   1. Migration has not been run yet');
      console.log('   2. No email triggers have been configured');
      console.log('   3. All triggers have been cleaned up\n');
      return;
    }

    // Analyze records
    let validCount = 0;
    let invalidCount = 0;
    let orphanedCount = 0;
    const invalidRecords = [];
    const orphanedRecords = [];

    console.log('========================================');
    console.log('Detailed Analysis');
    console.log('========================================\n');

    for (const tq of allTriggerQuestions) {
      const trigger = tq.emailTrigger;
      const question = tq.question;

      if (!question) {
        console.log(`❌ ORPHANED: EmailTriggerQuestion #${tq.id}`);
        console.log(`   Trigger #${tq.email_trigger_id}`);
        console.log(`   Question ID ${tq.question_id} - QUESTION NOT FOUND`);
        console.log(`   Action: DELETE THIS RECORD\n`);
        orphanedCount++;
        orphanedRecords.push({
          id: tq.id,
          triggerId: tq.email_trigger_id,
          questionId: tq.question_id
        });
        continue;
      }

      const templateId = question.Section?.Page?.Template?.id;
      const templateName = question.Section?.Page?.Template?.name;
      
      if (validQuestionIds.has(question.id)) {
        console.log(`✅ VALID: EmailTriggerQuestion #${tq.id}`);
        console.log(`   Trigger #${trigger?.id} (${trigger?.type}): ${trigger?.recipient}`);
        console.log(`   Question: "${question.question}"`);
        console.log(`   Key: ${question.question_key}`);
        if (tq.answer) {
          console.log(`   Expected Answer: "${tq.answer}"`);
        }
        console.log(`   Template: "${templateName}" (ID: ${templateId}) ✅ DEFAULT\n`);
        validCount++;
      } else {
        console.log(`❌ INVALID: EmailTriggerQuestion #${tq.id}`);
        console.log(`   Trigger #${trigger?.id} (${trigger?.type}): ${trigger?.recipient}`);
        console.log(`   Question: "${question.question}"`);
        console.log(`   Key: ${question.question_key}`);
        console.log(`   Template: "${templateName}" (ID: ${templateId}) ⚠️  NOT DEFAULT`);
        console.log(`   Action: DELETE AND RE-MIGRATE\n`);
        invalidCount++;
        invalidRecords.push({
          id: tq.id,
          triggerId: trigger?.id,
          triggerType: trigger?.type,
          recipient: trigger?.recipient,
          questionId: question.id,
          questionText: question.question,
          questionKey: question.question_key,
          wrongTemplateId: templateId,
          wrongTemplateName: templateName
        });
      }
    }

    console.log('========================================');
    console.log('Summary');
    console.log('========================================');
    console.log(`✅ Valid records: ${validCount}`);
    console.log(`❌ Invalid records (wrong template): ${invalidCount}`);
    console.log(`❌ Orphaned records (question deleted): ${orphanedCount}`);
    console.log(`📊 Total records: ${allTriggerQuestions.length}`);
    console.log('========================================\n');

    // Status assessment
    if (invalidCount === 0 && orphanedCount === 0) {
      console.log('🎉 SUCCESS: All EmailTriggerQuestion records are valid!');
      console.log('   Your email triggers are correctly configured.\n');
    } else {
      console.log('⚠️  ACTION REQUIRED: Issues detected!\n');
      
      if (invalidCount > 0) {
        console.log(`❌ ${invalidCount} record(s) link to questions from wrong templates`);
        console.log('   These email triggers will not work correctly.\n');
        console.log('   Invalid records:');
        invalidRecords.forEach(rec => {
          console.log(`   - Trigger #${rec.triggerId} → Question #${rec.questionId} from "${rec.wrongTemplateName}"`);
        });
        console.log('');
      }
      
      if (orphanedCount > 0) {
        console.log(`❌ ${orphanedCount} record(s) link to deleted questions`);
        console.log('   These email triggers will fail.\n');
        console.log('   Orphaned records:');
        orphanedRecords.forEach(rec => {
          console.log(`   - EmailTriggerQuestion #${rec.id} → Question #${rec.questionId} (DELETED)`);
        });
        console.log('');
      }

      console.log('🔧 RECOMMENDED ACTIONS:\n');
      console.log('   1. Run cleanup script:');
      console.log('      node cleanup-email-trigger-questions.js\n');
      console.log('   2. Re-run fixed migration:');
      console.log('      node migrate-email-trigger-questions-FIXED.js\n');
      console.log('   3. Run this verification again to confirm fix\n');
    }

    // Export issues to JSON for reference
    if (invalidCount > 0 || orphanedCount > 0) {
      const issuesReport = {
        timestamp: new Date().toISOString(),
        defaultTemplateId,
        defaultTemplateName: defaultTemplate.name,
        summary: {
          valid: validCount,
          invalid: invalidCount,
          orphaned: orphanedCount,
          total: allTriggerQuestions.length
        },
        invalidRecords,
        orphanedRecords
      };

      const fs = require('fs');
      const reportPath = './email-trigger-issues-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(issuesReport, null, 2));
      console.log(`📄 Detailed report saved to: ${reportPath}\n`);
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyEmailTriggerQuestions()
    .then(() => {
      console.log('✅ Verification completed\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = verifyEmailTriggerQuestions;