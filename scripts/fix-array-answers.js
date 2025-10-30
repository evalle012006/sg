'use strict';

const { EmailTrigger } = require('../models');
const { Op } = require('sequelize');

async function fixArrayAnswers() {
  try {
    console.log('========================================');
    console.log('Fix Array/Object Answers');
    console.log('========================================\n');

    const triggers = await EmailTrigger.findAll({
      where: {
        trigger_questions: { [Op.not]: null }
      }
    });

    console.log(`📊 Checking ${triggers.length} triggers...\n`);

    let fixedCount = 0;
    const issues = [];

    for (const trigger of triggers) {
      try {
        const questions = trigger.trigger_questions || [];
        let needsUpdate = false;

        const updatedQuestions = questions.map((tq, index) => {
          if (Array.isArray(tq.answer) || (typeof tq.answer === 'object' && tq.answer !== null)) {
            const originalAnswer = tq.answer;
            let fixedAnswer;

            if (Array.isArray(tq.answer)) {
              // Convert array to comma-separated string
              fixedAnswer = tq.answer.join(', ');
              console.log(`   🔧 Trigger #${trigger.id}, Q${index + 1}:`);
              console.log(`      Question: ${tq.question}`);
              console.log(`      Array answer: ${JSON.stringify(originalAnswer)}`);
              console.log(`      Fixed to: "${fixedAnswer}"\n`);
            } else {
              // Object - convert to JSON string
              fixedAnswer = JSON.stringify(tq.answer);
              console.log(`   🔧 Trigger #${trigger.id}, Q${index + 1}:`);
              console.log(`      Question: ${tq.question}`);
              console.log(`      Object answer: ${JSON.stringify(originalAnswer)}`);
              console.log(`      Fixed to: "${fixedAnswer}"\n`);
            }

            needsUpdate = true;
            issues.push({
              trigger_id: trigger.id,
              recipient: trigger.recipient,
              question: tq.question,
              original: originalAnswer,
              fixed: fixedAnswer
            });

            return {
              ...tq,
              answer: fixedAnswer
            };
          }
          return tq;
        });

        if (needsUpdate) {
          await trigger.update({
            trigger_questions: updatedQuestions
          });
          fixedCount++;
          console.log(`   ✅ Updated trigger #${trigger.id}\n`);
        }

      } catch (error) {
        console.error(`   ❌ Error processing trigger #${trigger.id}:`, error.message);
      }
    }

    console.log('\n========================================');
    console.log('Fix Summary');
    console.log('========================================');
    console.log(`🔧 Triggers fixed: ${fixedCount}`);
    console.log(`📝 Answers converted: ${issues.length}`);
    console.log('========================================\n');

    if (issues.length > 0) {
      console.log('⚠️  Please review these conversions:\n');
      issues.forEach(issue => {
        console.log(`Trigger #${issue.trigger_id} (${issue.recipient}):`);
        console.log(`  Question: "${issue.question}"`);
        console.log(`  Original: ${JSON.stringify(issue.original)}`);
        console.log(`  Fixed: "${issue.fixed}"`);
        console.log('');
      });

      console.log('\n💡 Note: Arrays were joined with ", " and objects were JSON-stringified.');
      console.log('If this is not the desired format, you may need to manually adjust these values.\n');
    }

    if (fixedCount > 0) {
      console.log('🎉 Fixed array/object answers!');
      console.log('Next steps:');
      console.log('1. Run: node scripts/fix-missing-question-keys.js');
      console.log('2. Then: node scripts/migrate-email-trigger-questions.js');
    } else {
      console.log('👍 No array/object answers found!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixArrayAnswers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = fixArrayAnswers;