'use strict';

const { EmailTrigger, Question } = require('../models');
const { Op } = require('sequelize');

async function fixMissingQuestionKeys() {
  try {
    console.log('========================================');
    console.log('Fix Missing question_key Values');
    console.log('========================================\n');

    // Get all questions from database for matching
    const allQuestions = await Question.findAll({
      attributes: ['id', 'question', 'question_key']
    });

    console.log(`📚 Found ${allQuestions.length} questions in database\n`);

    // Get triggers with missing question_key
    const triggers = await EmailTrigger.findAll({
      where: {
        trigger_questions: { [Op.not]: null }
      }
    });

    console.log(`📊 Found ${triggers.length} triggers to check\n`);

    let fixedCount = 0;
    let alreadyOkCount = 0;
    let cannotFixCount = 0;
    const unfixableDetails = [];

    for (const trigger of triggers) {
      try {
        const questions = trigger.trigger_questions || [];
        let triggerNeedsUpdate = false;
        let allQuestionsHaveKeys = true;

        const updatedQuestions = questions.map((tq, index) => {
          // Already has question_key
          if (tq.question_key) {
            return tq;
          }

          allQuestionsHaveKeys = false;

          // Try to match by question text
          const matchedQuestion = allQuestions.find(q => 
            q.question && tq.question && 
            q.question.trim().toLowerCase() === tq.question.trim().toLowerCase()
          );

          if (matchedQuestion) {
            console.log(`   ✅ Trigger #${trigger.id}, Q${index + 1}: Matched "${tq.question}" → ${matchedQuestion.question_key}`);
            triggerNeedsUpdate = true;
            return {
              ...tq,
              question_key: matchedQuestion.question_key
            };
          } else {
            console.log(`   ⚠️  Trigger #${trigger.id}, Q${index + 1}: Cannot match "${tq.question || '(no text)'}"`);
            unfixableDetails.push({
              trigger_id: trigger.id,
              recipient: trigger.recipient,
              question_text: tq.question,
              question_index: index
            });
            return tq;
          }
        });

        if (allQuestionsHaveKeys) {
          alreadyOkCount++;
        } else if (triggerNeedsUpdate) {
          // Update the trigger with fixed questions
          await trigger.update({
            trigger_questions: updatedQuestions
          });
          fixedCount++;
          console.log(`   💾 Updated trigger #${trigger.id}\n`);
        } else {
          cannotFixCount++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing trigger #${trigger.id}:`, error.message);
        cannotFixCount++;
      }
    }

    console.log('\n========================================');
    console.log('Fix Summary');
    console.log('========================================');
    console.log(`✅ Fixed: ${fixedCount}`);
    console.log(`👍 Already OK: ${alreadyOkCount}`);
    console.log(`❌ Cannot fix: ${cannotFixCount}`);
    console.log('========================================\n');

    if (unfixableDetails.length > 0) {
      console.log('⚠️  Questions that could not be matched:\n');
      unfixableDetails.forEach(detail => {
        console.log(`Trigger #${detail.trigger_id} (${detail.recipient}):`);
        console.log(`  Question: "${detail.question_text || '(empty)'}"`);
        console.log('');
      });
      
      console.log('\n💡 Suggestions:');
      console.log('1. Check if these questions exist in your Questions table');
      console.log('2. Check for typos or extra spaces in question text');
      console.log('3. Manually add question_key values to these triggers');
      console.log('4. Create missing questions in the database');
    }

    if (fixedCount > 0) {
      console.log('\n🎉 Successfully fixed some triggers!');
      console.log('Now re-run: node scripts/migrate-email-trigger-questions.js');
    }

    process.exit(unfixableDetails.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixMissingQuestionKeys()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = fixMissingQuestionKeys;