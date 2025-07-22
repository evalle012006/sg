// pages/api/admin/populate-question-keys.js
// or app/api/admin/populate-question-keys/route.js (for App Router)

import { Question, Section } from "../../../models";
import { Op } from 'sequelize';

// Question types that should skip question_key generation
const SKIP_KEY_GENERATION_TYPES = ['url', 'file-upload', 'health-info', 'goal-table', 'care-table'];

async function generateQuestionKey(questionText, sectionId, usedKeysInSection) {
    if (!questionText || typeof questionText !== 'string') {
        return null;
    }

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
    
    while (true) {
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Add basic auth check if needed
    // if (!req.headers.authorization) {
    //     return res.status(401).json({ error: 'Unauthorized' });
    // }

    try {
        const questions = await Question.findAll({
            where: {
                question_key: null,
                question: {
                    [Op.ne]: null
                }
            },
            include: [Section],
            order: [['section_id', 'ASC'], ['id', 'ASC']]
        });

        if (questions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No questions need question_key population.',
                summary: { processed: 0, updated: 0, skipped: 0 }
            });
        }

        let updatedCount = 0;
        let skippedCount = 0;

        const questionsBySection = {};
        questions.forEach(question => {
            if (!questionsBySection[question.section_id]) {
                questionsBySection[question.section_id] = [];
            }
            questionsBySection[question.section_id].push(question);
        });

        for (const [sectionId, sectionQuestions] of Object.entries(questionsBySection)) {
            const usedKeysInSection = new Set();

            for (const question of sectionQuestions) {
                if (shouldSkipKeyGeneration(question.type)) {
                    skippedCount++;
                    continue;
                }

                const questionKey = await generateQuestionKey(
                    question.question, 
                    parseInt(sectionId), 
                    usedKeysInSection
                );
                
                if (questionKey) {
                    await question.update({ question_key: questionKey });
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Question keys populated successfully',
            summary: {
                processed: questions.length,
                updated: updatedCount,
                skipped: skippedCount
            }
        });

    } catch (error) {
        console.error('Error populating question keys:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to populate question keys',
            details: error.message
        });
    }
}