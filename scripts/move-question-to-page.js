'use strict';

/**
 * Move Question to Different Page Script
 * 
 * This script moves a question from one page to another with smart section handling:
 * 
 * Logic:
 * 1. If the source section type is "rows" or "row":
 *    - If only 1 question in section: Move the entire section to the target page
 *    - If multiple questions: Create a new "rows" section on target page and move just the question
 * 
 * 2. If the source section type is NOT "rows"/"row" (e.g., "2_columns", "3_columns"):
 *    - Create a new "rows" section on the target page
 *    - Move the question to the new section
 *    - Clean up empty source section if needed
 * 
 * Usage:
 *   node scripts/move-question-to-page.js <question_id> <target_page_id> [--dry-run]
 * 
 * Examples:
 *   node scripts/move-question-to-page.js 5200 295           # Move question 5200 to page 295
 *   node scripts/move-question-to-page.js 5200 295 --dry-run # Preview without changes
 * 
 */

// # Preview first (recommended)
// node scripts/move-question-to-page.js 5200 295 --dry-run

// # Execute
// node scripts/move-question-to-page.js 5200 295

// # Batch move multiple questions
// node scripts/move-question-to-page.js --batch 5200,5201,5202 295 --dry-run
// node scripts/move-question-to-page.js --batch 5200,5201,5202 295

const { Page, Section, Question, QuestionDependency, sequelize } = require('../models');
const { Op } = require('sequelize');

// Section types that should be moved entirely (when single question)
const MOVABLE_SECTION_TYPES = ['rows', 'row'];

async function moveQuestionToPage(questionId, targetPageId, dryRun = false) {
  console.log('\n========================================');
  console.log('Move Question to Page Script');
  console.log(dryRun ? '(DRY RUN - No changes will be made)' : '(LIVE RUN)');
  console.log('========================================\n');

  // ============================================================================
  // STEP 1: Validate inputs and fetch data
  // ============================================================================
  
  console.log('📊 Step 1: Fetching question and target page...\n');

  // Get the question with its section
  const question = await Question.findByPk(questionId, {
    include: [{
      model: Section,
      include: [{
        model: Question,
        attributes: ['id', 'question', 'order']
      }]
    }]
  });

  if (!question) {
    console.error(`❌ Question with ID ${questionId} not found!`);
    process.exit(1);
  }

  const sourceSection = question.Section;
  if (!sourceSection) {
    console.error(`❌ Question ${questionId} has no associated section!`);
    process.exit(1);
  }

  // Get the source page
  let sourcePage = null;
  if (sourceSection.model_type === 'page') {
    sourcePage = await Page.findByPk(sourceSection.model_id);
  }

  // Get the target page
  const targetPage = await Page.findByPk(targetPageId, {
    include: [{
      model: Section,
      order: [['order', 'DESC']]
    }]
  });

  if (!targetPage) {
    console.error(`❌ Target page with ID ${targetPageId} not found!`);
    process.exit(1);
  }

  // Check if question is already on target page
  if (sourcePage && sourcePage.id === targetPage.id) {
    console.error(`❌ Question is already on page "${targetPage.title}" (ID: ${targetPageId})!`);
    process.exit(1);
  }

  // Count questions in source section
  const questionsInSourceSection = sourceSection.Questions?.length || 0;
  const isOnlyQuestionInSection = questionsInSourceSection === 1;
  const isSectionTypeMovable = MOVABLE_SECTION_TYPES.includes(sourceSection.type);

  console.log('📋 Question Details:');
  console.log(`   ID: ${question.id}`);
  console.log(`   Question: "${question.question?.substring(0, 60)}..."`);
  console.log(`   Question Key: ${question.question_key || 'N/A'}`);
  console.log(`   Type: ${question.type}`);
  console.log('');
  
  console.log('📋 Source Section Details:');
  console.log(`   ID: ${sourceSection.id}`);
  console.log(`   Label: "${sourceSection.label || '(no label)'}"`);
  console.log(`   Type: ${sourceSection.type}`);
  console.log(`   Questions in section: ${questionsInSourceSection}`);
  if (sourcePage) {
    console.log(`   Page: "${sourcePage.title}" (ID: ${sourcePage.id})`);
  }
  console.log('');

  console.log('📋 Target Page Details:');
  console.log(`   ID: ${targetPage.id}`);
  console.log(`   Title: "${targetPage.title}"`);
  console.log(`   Existing sections: ${targetPage.Sections?.length || 0}`);
  console.log('');

  // ============================================================================
  // STEP 2: Determine migration strategy
  // ============================================================================
  
  console.log('📊 Step 2: Determining migration strategy...\n');

  let strategy = '';
  let moveEntireSection = false;

  if (isSectionTypeMovable && isOnlyQuestionInSection) {
    strategy = 'MOVE_SECTION';
    moveEntireSection = true;
    console.log('   Strategy: MOVE_SECTION');
    console.log('   → Section type is "rows" and has only 1 question');
    console.log('   → Will move the entire section to target page');
  } else if (isSectionTypeMovable && !isOnlyQuestionInSection) {
    strategy = 'CREATE_NEW_SECTION';
    console.log('   Strategy: CREATE_NEW_SECTION');
    console.log('   → Section type is "rows" but has multiple questions');
    console.log('   → Will create new "rows" section on target page');
    console.log('   → Will move only this question to new section');
  } else {
    strategy = 'CREATE_NEW_SECTION';
    console.log('   Strategy: CREATE_NEW_SECTION');
    console.log(`   → Section type is "${sourceSection.type}" (not rows)`);
    console.log('   → Will create new "rows" section on target page');
    console.log('   → Will move only this question to new section');
  }
  console.log('');

  // ============================================================================
  // STEP 3: Check for dependencies
  // ============================================================================
  
  console.log('📊 Step 3: Checking question dependencies...\n');

  // Find dependencies where this question depends on others
  const dependsOn = await QuestionDependency.findAll({
    where: { question_id: questionId }
  });

  // Find dependencies where other questions depend on this one
  const dependedBy = await QuestionDependency.findAll({
    where: { dependence_id: questionId }
  });

  if (dependsOn.length > 0) {
    console.log(`   ⚠️  This question depends on ${dependsOn.length} other question(s):`);
    for (const dep of dependsOn) {
      const depQuestion = await Question.findByPk(dep.dependence_id);
      console.log(`      - Q${dep.dependence_id}: "${depQuestion?.question?.substring(0, 40)}..." (answer: "${dep.answer}")`);
    }
    console.log('   → Dependencies will be preserved (IDs remain the same)');
  } else {
    console.log('   ✅ This question has no dependencies on other questions');
  }

  if (dependedBy.length > 0) {
    console.log(`   ⚠️  ${dependedBy.length} question(s) depend on this question:`);
    for (const dep of dependedBy) {
      const depQuestion = await Question.findByPk(dep.question_id);
      console.log(`      - Q${dep.question_id}: "${depQuestion?.question?.substring(0, 40)}..." (answer: "${dep.answer}")`);
    }
    console.log('   → Dependencies will be preserved (IDs remain the same)');
  } else {
    console.log('   ✅ No other questions depend on this question');
  }
  console.log('');

  // ============================================================================
  // STEP 4: Execute migration
  // ============================================================================
  
  if (dryRun) {
    console.log('📊 Step 4: Preview (DRY RUN)...\n');
    
    if (moveEntireSection) {
      const maxOrder = Math.max(...(targetPage.Sections?.map(s => s.order) || [0]), 0);
      console.log('   Would update section:');
      console.log(`   - Section ID: ${sourceSection.id}`);
      console.log(`   - New model_id: ${targetPage.id} (was: ${sourceSection.model_id})`);
      console.log(`   - New order: ${maxOrder + 1}`);
    } else {
      const maxOrder = Math.max(...(targetPage.Sections?.map(s => s.order) || [0]), 0);
      console.log('   Would create new section:');
      console.log(`   - Label: "${sourceSection.label || ''}"`);
      console.log(`   - Type: "rows"`);
      console.log(`   - model_id: ${targetPage.id}`);
      console.log(`   - model_type: "page"`);
      console.log(`   - Order: ${maxOrder + 1}`);
      console.log('');
      console.log('   Would update question:');
      console.log(`   - Question ID: ${question.id}`);
      console.log(`   - New section_id: [new section ID]`);
      console.log(`   - New order: 0`);
      
      if (isOnlyQuestionInSection) {
        console.log('');
        console.log('   Would delete empty source section:');
        console.log(`   - Section ID: ${sourceSection.id}`);
      }
    }
    
    console.log('\n✨ DRY RUN complete. No changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
    return;
  }

  console.log('📊 Step 4: Executing migration...\n');

  const transaction = await sequelize.transaction();

  try {
    if (moveEntireSection) {
      // Strategy: Move entire section
      const maxOrder = Math.max(...(targetPage.Sections?.map(s => s.order) || [0]), 0);
      
      await Section.update(
        {
          model_id: targetPage.id,
          order: maxOrder + 1
        },
        {
          where: { id: sourceSection.id },
          transaction
        }
      );
      
      console.log(`   ✅ Moved section ${sourceSection.id} to page ${targetPage.id}`);
      console.log(`      New order: ${maxOrder + 1}`);
      
    } else {
      // Strategy: Create new section and move question
      const maxOrder = Math.max(...(targetPage.Sections?.map(s => s.order) || [0]), 0);
      
      // Create new section
      const newSection = await Section.create(
        {
          label: sourceSection.label || '',
          type: 'rows',
          model_id: targetPage.id,
          model_type: 'page',
          order: maxOrder + 1,
          orig_section_id: sourceSection.orig_section_id
        },
        { transaction }
      );
      
      console.log(`   ✅ Created new section with ID: ${newSection.id}`);
      console.log(`      Label: "${newSection.label || '(no label)'}"`);
      console.log(`      Type: rows`);
      console.log(`      Order: ${maxOrder + 1}`);
      
      // Update question to point to new section
      await Question.update(
        {
          section_id: newSection.id,
          order: 0
        },
        {
          where: { id: question.id },
          transaction
        }
      );
      
      console.log(`   ✅ Moved question ${question.id} to new section ${newSection.id}`);
      
      // Clean up empty source section if it was the only question
      if (isOnlyQuestionInSection) {
        await Section.destroy({
          where: { id: sourceSection.id },
          transaction
        });
        console.log(`   ✅ Deleted empty source section ${sourceSection.id}`);
      } else {
        // Reorder remaining questions in source section
        const remainingQuestions = sourceSection.Questions
          .filter(q => q.id !== question.id)
          .sort((a, b) => a.order - b.order);
        
        for (let i = 0; i < remainingQuestions.length; i++) {
          await Question.update(
            { order: i },
            {
              where: { id: remainingQuestions[i].id },
              transaction
            }
          );
        }
        console.log(`   ✅ Reordered ${remainingQuestions.length} remaining questions in source section`);
      }
    }

    await transaction.commit();
    
    console.log('\n✅ Migration complete!\n');
    
    // Print summary
    console.log('📊 Summary:');
    console.log(`   Question "${question.question?.substring(0, 40)}..." (ID: ${question.id})`);
    console.log(`   Moved from: "${sourcePage?.title || 'Unknown'}" (Page ID: ${sourcePage?.id || 'N/A'})`);
    console.log(`   Moved to: "${targetPage.title}" (Page ID: ${targetPage.id})`);
    console.log('');

  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Migration failed! Transaction rolled back.');
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ============================================================================
// BATCH MOVE: Move multiple questions at once
// ============================================================================

async function moveMultipleQuestions(questionIds, targetPageId, dryRun = false) {
  console.log('\n========================================');
  console.log('Batch Move Questions to Page Script');
  console.log(dryRun ? '(DRY RUN - No changes will be made)' : '(LIVE RUN)');
  console.log('========================================\n');

  console.log(`Moving ${questionIds.length} questions to page ${targetPageId}\n`);

  for (const questionId of questionIds) {
    console.log(`\n--- Processing Question ID: ${questionId} ---\n`);
    await moveQuestionToPage(questionId, targetPageId, dryRun);
  }

  console.log('\n========================================');
  console.log('Batch operation complete!');
  console.log('========================================\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('\nUsage:');
    console.log('  Single question:');
    console.log('    node scripts/move-question-to-page.js <question_id> <target_page_id> [--dry-run]');
    console.log('');
    console.log('  Multiple questions:');
    console.log('    node scripts/move-question-to-page.js --batch <question_ids_comma_separated> <target_page_id> [--dry-run]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/move-question-to-page.js 5200 295');
    console.log('  node scripts/move-question-to-page.js 5200 295 --dry-run');
    console.log('  node scripts/move-question-to-page.js --batch 5200,5201,5202 295');
    console.log('  node scripts/move-question-to-page.js --batch 5200,5201,5202 295 --dry-run');
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const isBatch = args.includes('--batch');

  try {
    if (isBatch) {
      const batchIndex = args.indexOf('--batch');
      const questionIdsStr = args[batchIndex + 1];
      const targetPageId = parseInt(args[batchIndex + 2]);
      
      if (!questionIdsStr || !targetPageId) {
        console.error('❌ Invalid arguments for batch mode');
        process.exit(1);
      }
      
      const questionIds = questionIdsStr.split(',').map(id => parseInt(id.trim()));
      await moveMultipleQuestions(questionIds, targetPageId, dryRun);
    } else {
      const questionId = parseInt(args[0]);
      const targetPageId = parseInt(args[1]);
      
      if (!questionId || !targetPageId) {
        console.error('❌ Invalid question_id or target_page_id');
        process.exit(1);
      }
      
      await moveQuestionToPage(questionId, targetPageId, dryRun);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();