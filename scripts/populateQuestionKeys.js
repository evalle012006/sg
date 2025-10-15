'use strict';

// 1. Convert ES module imports to CommonJS requires
const { Question, Section } = require('../models'); 
// Assuming your models index exports them: require('../models/index') or similar
const { Op } = require('sequelize');


// Question types that should skip question_key generation
const SKIP_KEY_GENERATION_TYPES = ['url', 'file-upload', 'health-info', 'goal-table', 'care-table'];

/**
 * Generates a unique, slug-like key for a question within a specific section.
 * @param {string} questionText - The text of the question.
 * @param {number} sectionId - The ID of the section.
 * @param {Set<string>} usedKeysInSection - A Set of keys already used in this session for the current section.
 * @returns {Promise<string|null>} The generated unique key or null.
 */
async function generateQuestionKey(questionText, sectionId, usedKeysInSection) {
    if (!questionText || typeof questionText !== 'string') {
        return null;
    }

    // Slugify the question text
    let baseKey = questionText
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (baseKey.length > 100) {
        baseKey = baseKey.substring(0, 100).replace(/-[^-]*$/, '');
    }

    if (!baseKey) {
        baseKey = 'question';
    }

    let questionKey = baseKey;
    let suffix = 1;
    
    // Check for uniqueness in DB (only in the current section) and current session
    while (true) {
        // Find one existing question in the DB for the current section with this key
        const existingInDb = await Question.findOne({
            where: {
                question_key: questionKey,
                section_id: sectionId
            }
        });

        const existingInCurrentSession = usedKeysInSection.has(questionKey);

        if (!existingInDb && !existingInCurrentSession) {
            break;
        }

        questionKey = `${baseKey}-${suffix}`;
        suffix++;
    }

    usedKeysInSection.add(questionKey);
    return questionKey;
}

function shouldSkipKeyGeneration(questionType) {
    return SKIP_KEY_GENERATION_TYPES.includes(questionType);
}

/**
 * Migration script to populate question_key for existing questions.
 */
async function populateQuestionKeys() {
    try {
        console.log('\n========================================');
        console.log('Question Key Population Script');
        console.log('========================================\n');
        
        // 1. Find all questions that need a key
        const questions = await Question.findAll({
            where: {
                question_key: null,
                question: {
                    [Op.ne]: null // Ensure question text exists
                }
            },
            include: [Section],
            // Order by section and then ID to ensure proper key sequencing within a section
            order: [['section_id', 'ASC'], ['id', 'ASC']]
        });

        console.log(`📊 Found ${questions.length} questions to process\n`);

        if (questions.length === 0) {
            console.log('✅ No questions need key population. All done!');
            return;
        }

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Group questions by section_id to enforce uniqueness per section
        const questionsBySection = {};
        questions.forEach(question => {
            const sectionId = question.section_id;
            if (!questionsBySection[sectionId]) {
                questionsBySection[sectionId] = [];
            }
            questionsBySection[sectionId].push(question);
        });

        // 2. Process questions section by section
        for (const [sectionId, sectionQuestions] of Object.entries(questionsBySection)) {
            // Set to track keys generated *in this run* for the current section to prevent duplicates
            const usedKeysInSection = new Set();
            const sectionName = sectionQuestions[0].Section ? sectionQuestions[0].Section.name : `ID: ${sectionId}`;
            
            console.log(`\n--- Processing Section: ${sectionName} (${sectionQuestions.length} questions) ---`);

            for (const question of sectionQuestions) {
                try {
                    const questionId = question.id;
                    const questionType = question.type;

                    if (shouldSkipKeyGeneration(questionType)) {
                        console.log(`   ⏭️  Skipping question #${questionId} (Type: ${questionType})`);
                        skippedCount++;
                        continue;
                    }

                    // Generate a unique key for the question
                    const questionKey = await generateQuestionKey(
                        question.question, 
                        parseInt(sectionId), 
                        usedKeysInSection
                    );
                    
                    if (questionKey) {
                        // 3. Update the question record
                        await question.update({ question_key: questionKey });
                        console.log(`   ✅ Updated question #${questionId}: Key → ${questionKey}`);
                        updatedCount++;
                    } else {
                        console.log(`   ⚠️  Skipping question #${questionId} (No text available)`);
                        skippedCount++;
                    }
                } catch (error) {
                    console.error(`   ❌ Error processing question #${question.id}:`, error.message);
                    errorCount++;
                }
            }
        }

        // 4. Summary
        console.log('\n========================================');
        console.log('Population Summary');
        console.log('========================================');
        console.log(`✅ Successfully updated: ${updatedCount}`);
        console.log(`⏭️  Skipped: ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📊 Total processed: ${questions.length}`);
        console.log('========================================\n');

        if (errorCount > 0) {
            console.log('⚠️  Some questions failed to update. Please review the errors above.');
            process.exit(1);
        } else {
            console.log('🎉 Question key population completed successfully!');
        }

    } catch (error) {
        console.error('\n❌ Question Key Population failed:', error);
        throw error;
    }
}

// Run population if called directly
if (require.main === module) {
    populateQuestionKeys()
        .then(() => {
            console.log('\n✅ Script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = populateQuestionKeys;