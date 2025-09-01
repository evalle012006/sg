// finish-remaining.js - Process the remaining 554 questions

import { Question, Section } from "../../../models";
import { Op } from 'sequelize';

const SKIP_KEY_GENERATION_TYPES = ['url', 'file-upload', 'health-info', 'goal-table', 'care-table'];

async function generateQuestionKey(questionText, questionType, questionId, sectionId, usedKeysInSection) {
    if (!questionText || typeof questionText !== 'string' || questionText.trim() === '') {
        return null;
    }

    let baseKey = questionText
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (baseKey.length < 2) {
        baseKey = `${questionType || 'question'}-${questionId}`;
    }

    if (baseKey.length > 100) {
        baseKey = baseKey.substring(0, 100).replace(/-[^-]*$/, '');
    }

    // Check uniqueness within section
    let questionKey = baseKey;
    let suffix = 1;
    
    while (true) {
        const existingInDb = await Question.findOne({
            where: {
                question_key: questionKey,
                section_id: sectionId
            }
        });

        if (!existingInDb && !usedKeysInSection.has(questionKey)) {
            break;
        }

        questionKey = `${baseKey}-${suffix}`;
        suffix++;
        
        // Safety check
        if (suffix > 100) {
            questionKey = `${baseKey}-${questionId}`;
            break;
        }
    }

    usedKeysInSection.add(questionKey);
    return questionKey;
}

async function processRemainingQuestions() {
    console.log('🔄 Processing remaining 554 questions...\n');

    // Get ALL remaining questions at once
    const remainingQuestions = await Question.findAll({
        where: {
            [Op.or]: [
                { question_key: null },
                { question_key: '' }
            ],
            question: {
                [Op.and]: [
                    { [Op.ne]: null },
                    { [Op.ne]: '' }
                ]
            },
            type: {
                [Op.notIn]: SKIP_KEY_GENERATION_TYPES
            }
        },
        order: [['section_id', 'ASC'], ['id', 'ASC']]
    });

    console.log(`📊 Found ${remainingQuestions.length} remaining questions to process`);

    if (remainingQuestions.length === 0) {
        console.log('✅ No remaining questions found!');
        return { processed: 0, errors: 0 };
    }

    // Show sample of what we're about to process
    console.log('\n📝 Sample questions to process:');
    remainingQuestions.slice(0, 5).forEach((q, i) => {
        console.log(`  ${i + 1}. ID ${q.id} (${q.type}): "${q.question?.substring(0, 60)}..."`);
    });
    console.log('');

    let totalProcessed = 0;
    let totalErrors = 0;
    const errors = [];

    // Group by section
    const questionsBySection = {};
    remainingQuestions.forEach(question => {
        if (!questionsBySection[question.section_id]) {
            questionsBySection[question.section_id] = [];
        }
        questionsBySection[question.section_id].push(question);
    });

    console.log(`🏗️  Processing ${Object.keys(questionsBySection).length} sections...`);

    // Process each section
    for (const [sectionId, sectionQuestions] of Object.entries(questionsBySection)) {
        console.log(`📂 Processing section ${sectionId}: ${sectionQuestions.length} questions`);
        const usedKeysInSection = new Set();

        // Get existing keys in this section to avoid conflicts
        const existingKeys = await Question.findAll({
            where: {
                section_id: parseInt(sectionId),
                question_key: { [Op.ne]: null }
            },
            attributes: ['question_key']
        });

        existingKeys.forEach(q => {
            if (q.question_key) {
                usedKeysInSection.add(q.question_key);
            }
        });

        // Process questions in this section
        for (const question of sectionQuestions) {
            try {
                const questionKey = await generateQuestionKey(
                    question.question,
                    question.type,
                    question.id,
                    parseInt(sectionId),
                    usedKeysInSection
                );
                
                if (questionKey) {
                    await question.update({ question_key: questionKey });
                    totalProcessed++;
                    
                    if (totalProcessed % 50 === 0) {
                        console.log(`  📈 Progress: ${totalProcessed} questions updated...`);
                    }
                } else {
                    console.warn(`  ⚠️  Could not generate key for question ${question.id}`);
                    errors.push({
                        id: question.id,
                        reason: 'No key generated',
                        question: question.question?.substring(0, 100)
                    });
                }

            } catch (error) {
                console.error(`  ❌ Error processing question ${question.id}:`, error.message);
                totalErrors++;
                errors.push({
                    id: question.id,
                    reason: error.message,
                    question: question.question?.substring(0, 100)
                });
            }
        }
    }

    // Final verification
    const stillRemaining = await Question.count({
        where: {
            [Op.or]: [
                { question_key: null },
                { question_key: '' }
            ],
            question: {
                [Op.and]: [
                    { [Op.ne]: null },
                    { [Op.ne]: '' }
                ]
            },
            type: {
                [Op.notIn]: SKIP_KEY_GENERATION_TYPES
            }
        }
    });

    console.log('\n🎉 SECOND PASS COMPLETED!');
    console.log(`✅ Additional questions processed: ${totalProcessed}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log(`🔍 Still remaining: ${stillRemaining}`);

    if (errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        errors.slice(0, 10).forEach(error => {
            console.log(`  Question ${error.id}: ${error.reason}`);
            if (error.question) {
                console.log(`    Text: "${error.question}"`);
            }
        });
    }

    if (stillRemaining === 0) {
        console.log('\n🏆 SUCCESS! All processable questions now have keys!');
    } else if (stillRemaining < 10) {
        console.log('\n📋 Final remaining questions:');
        const finalRemaining = await Question.findAll({
            where: {
                [Op.or]: [
                    { question_key: null },
                    { question_key: '' }
                ],
                question: {
                    [Op.and]: [
                        { [Op.ne]: null },
                        { [Op.ne]: '' }
                    ]
                },
                type: {
                    [Op.notIn]: SKIP_KEY_GENERATION_TYPES
                }
            },
            limit: 10
        });
        
        finalRemaining.forEach((q, i) => {
            console.log(`  ${i + 1}. ID ${q.id} (${q.type}): "${q.question}"`);
        });
    }

    return {
        processed: totalProcessed,
        errors: totalErrors,
        remaining: stillRemaining,
        errorDetails: errors
    };
}

// Execute the script
processRemainingQuestions()
    .then(results => {
        console.log(`\n🏁 FINAL TALLY:`);
        console.log(`   Total processed in this run: ${results.processed}`);
        console.log(`   Previous run: 605`);
        console.log(`   Grand total: ${605 + results.processed}`);
        console.log(`   Errors: ${results.errors}`);
        console.log(`   Still remaining: ${results.remaining}`);
        
        if (results.remaining === 0) {
            console.log('\n🎊 COMPLETE SUCCESS! All questions have been processed!');
        } else if (results.remaining < 20) {
            console.log('\n🎯 Nearly there! Only a few questions left to handle manually.');
        }
        
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });