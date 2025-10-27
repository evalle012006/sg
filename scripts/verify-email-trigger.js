'use strict';

const { EmailTrigger, EmailTriggerQuestion, Question, sequelize } = require('../models');

/**
 * Verification script to check the email trigger questions migration
 * This script will:
 * 1. Compare JSON data with relational data
 * 2. Identify any mismatches or missing data
 * 3. Provide a detailed report
 */
async function verifyMigration() {
  try {
    console.log('\n========================================');
    console.log('Email Trigger Questions Migration Verification');
    console.log('========================================\n');

    // Get all triggers with JSON questions
    const triggers = await EmailTrigger.findAll({
      where: {
        trigger_questions: {
          [require('sequelize').Op.not]: null
        }
      },
      include: [{
        model: EmailTriggerQuestion,
        as: 'triggerQuestions',
        include: [{
          model: Question,
          as: 'question'
        }]
      }]
    });

    console.log(`📊 Found ${triggers.length} trigger(s) with JSON data\n`);

    if (triggers.length === 0) {
      console.log('✅ No triggers to verify');
      return;
    }

    let perfectMatches = 0;
    let partialMatches = 0;
    let mismatches = 0;
    let totalJsonQuestions = 0;
    let totalRelationalQuestions = 0;

    console.log('Verifying each trigger:\n');
    console.log('─'.repeat(80));

    for (const trigger of triggers) {
      const jsonQuestions = trigger.trigger_questions || [];
      const relationalQuestions = trigger.triggerQuestions || [];

      totalJsonQuestions += jsonQuestions.length;
      totalRelationalQuestions += relationalQuestions.length;

      console.log(`\nTrigger #${trigger.id} (${trigger.recipient}):`);
      console.log(`  JSON Questions: ${jsonQuestions.length}`);
      console.log(`  Relational Questions: ${relationalQuestions.length}`);

      if (jsonQuestions.length === 0 && relationalQuestions.length === 0) {
        console.log(`  ✅ Both empty (OK)`);
        perfectMatches++;
        continue;
      }

      if (relationalQuestions.length === 0) {
        console.log(`  ❌ MIGRATION NEEDED: Has JSON data but no relational data`);
        mismatches++;
        continue;
      }

      // Compare counts
      if (jsonQuestions.length !== relationalQuestions.length) {
        console.log(`  ⚠️  Count mismatch!`);
        partialMatches++;
      }

      // Verify each JSON question has a matching relational record
      let matchedCount = 0;
      const unmatchedJsonQuestions = [];

      for (const jsonQ of jsonQuestions) {
        const matched = relationalQuestions.find(relQ => 
          relQ.question && relQ.question.question_key === jsonQ.question_key
        );

        if (matched) {
          matchedCount++;
          // Verify answer matches
          if (matched.answer !== jsonQ.answer) {
            console.log(`  ⚠️  Answer mismatch for "${jsonQ.question_key}"`);
            console.log(`     JSON: "${jsonQ.answer}" | Relational: "${matched.answer}"`);
          }
        } else {
          unmatchedJsonQuestions.push(jsonQ.question_key);
        }
      }

      if (unmatchedJsonQuestions.length > 0) {
        console.log(`  ❌ Unmatched questions: ${unmatchedJsonQuestions.join(', ')}`);
        partialMatches++;
      } else if (jsonQuestions.length === relationalQuestions.length) {
        console.log(`  ✅ Perfect match!`);
        perfectMatches++;
      } else {
        console.log(`  ⚠️  ${matchedCount}/${jsonQuestions.length} questions matched`);
        partialMatches++;
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('\n========================================');
    console.log('Verification Summary');
    console.log('========================================');
    console.log(`✅ Perfect matches: ${perfectMatches}`);
    console.log(`⚠️  Partial matches: ${partialMatches}`);
    console.log(`❌ Mismatches/Not migrated: ${mismatches}`);
    console.log(`📊 Total triggers checked: ${triggers.length}`);
    console.log(`📝 JSON questions: ${totalJsonQuestions}`);
    console.log(`🔗 Relational questions: ${totalRelationalQuestions}`);
    console.log('========================================\n');

    // Check for orphaned relational questions
    const [orphanedCheck] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM email_trigger_questions etq
      LEFT JOIN email_triggers et ON etq.email_trigger_id = et.id
      WHERE et.id IS NULL
    `);

    const orphanedCount = orphanedCheck[0].count;
    if (orphanedCount > 0) {
      console.log(`⚠️  Found ${orphanedCount} orphaned question link(s) (trigger no longer exists)`);
    }

    // Overall status
    if (mismatches === 0 && partialMatches === 0) {
      console.log('🎉 Migration verification PASSED! All data matches perfectly.\n');
      return true;
    } else if (mismatches > 0) {
      console.log('❌ Migration verification FAILED! Some triggers need migration.\n');
      console.log('Run the migration script to fix:\n');
      console.log('  node scripts/migrate-email-trigger-questions.js\n');
      return false;
    } else {
      console.log('⚠️  Migration verification passed with warnings.\n');
      console.log('Some triggers have minor discrepancies. Review the details above.\n');
      return true;
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyMigration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = verifyMigration;