'use strict';

const { EmailTrigger } = require('../models');
const { Op } = require('sequelize');

async function inspectTriggerQuestions() {
  try {
    console.log('========================================');
    console.log('Inspecting trigger_questions JSON');
    console.log('========================================\n');

    const triggers = await EmailTrigger.findAll({
      where: {
        trigger_questions: { [Op.not]: null }
      },
      attributes: ['id', 'recipient', 'trigger_questions'],
      limit: 5 // Just look at first 5
    });

    triggers.forEach((trigger, index) => {
      console.log(`\n🔍 Trigger #${trigger.id}:`);
      console.log(`   Recipient: ${trigger.recipient || '(empty)'}`);
      
      try {
        const questions = trigger.trigger_questions || [];
        console.log(`   Questions count: ${questions.length}`);
        
        questions.forEach((q, qIndex) => {
          console.log(`\n   Question ${qIndex + 1}:`);
          console.log(`   - Has question_key: ${q.question_key ? '✅ YES' : '❌ NO'}`);
          console.log(`   - question_key value: ${q.question_key || '(missing)'}`);
          console.log(`   - question text: ${q.question || '(no text)'}`);
          console.log(`   - answer: ${JSON.stringify(q.answer)}`);
          console.log(`   - Full keys: ${Object.keys(q).join(', ')}`);
        });
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
      
      if (index < triggers.length - 1) {
        console.log('\n' + '─'.repeat(60));
      }
    });

    console.log('\n\n========================================');
    console.log('Analysis Complete');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  inspectTriggerQuestions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = inspectTriggerQuestions;