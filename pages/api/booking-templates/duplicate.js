import { Page, Question, QuestionDependency, Section, Template, sequelize } from "../../../models";

// Question types that should skip question_key generation
const SKIP_KEY_GENERATION_TYPES = ['url', 'file-upload', 'health-info', 'goal-table', 'care-table'];

/**
 * Generate a unique question key from question text within a specific scope
 * @param {string} questionText - The question text
 * @param {number} sectionId - The section ID for scoped uniqueness
 * @param {Set} usedKeysInSection - Set of already used keys in this section
 * @returns {Promise<string>} - Generated unique question key
 */
async function generateQuestionKeyForCopy(questionText, sectionId, usedKeysInSection = new Set()) {
    if (!questionText || typeof questionText !== 'string') {
        return null;
    }

    // Base key generation: lowercase, remove special chars, replace spaces with hyphens
    let baseKey = questionText
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end

    // Limit length to reasonable size
    if (baseKey.length > 100) {
        baseKey = baseKey.substring(0, 100).replace(/-[^-]*$/, ''); // Cut at word boundary
    }

    if (!baseKey) {
        // Fallback if question text doesn't generate valid key
        baseKey = 'question';
    }

    // Check for uniqueness within the section scope and add suffix if needed
    let questionKey = baseKey;
    let suffix = 1;
    
    while (true) {
        // Check both database and current copying session
        const existingInDb = await Question.findOne({
            where: { 
                question_key: questionKey,
                section_id: sectionId
            }
        });

        const existingInCurrentCopy = usedKeysInSection.has(questionKey);

        if (!existingInDb && !existingInCurrentCopy) {
            break;
        }

        questionKey = `${baseKey}-${suffix}`;
        suffix++;
    }

    usedKeysInSection.add(questionKey);
    return questionKey;
}

/**
 * Check if question type should skip key generation
 * @param {string} questionType - The question type
 * @returns {boolean} - Whether to skip key generation
 */
function shouldSkipKeyGeneration(questionType) {
    return SKIP_KEY_GENERATION_TYPES.includes(questionType);
}

export default async function handler(req, res) {
    const { uuid } = req.body;

    if (req.method !== "POST") {
        return res.status(400).json({ error: "Method not allowed" });
    }

    try {
        const currentTemplate = await Template.findOne({ 
            where: { uuid }, 
            include: [{ 
                model: Page, 
                include: [{ 
                    model: Section, 
                    include: [{ 
                        model: Question, 
                        include: [QuestionDependency] 
                    }] 
                }] 
            }] 
        });

        if (!currentTemplate) {
            return res.status(404).json({ error: "Template not found" });
        }

        const masterDuplicationData = { pages: {}, sections: {}, questions: {} };
        // Track used question keys per section to avoid duplicates during copying
        const sectionQuestionKeys = {};
        
        await sequelize.transaction(async (t) => {
            const newTemplate = await Template.create({
                name: currentTemplate.name + ' copy',
            }, { transaction: t });

            for (const page of currentTemplate.Pages) {
                const newPage = await Page.create({
                    title: page.title,
                    description: page.description,
                    template_id: newTemplate.id,
                    order: page.order
                }, { transaction: t });
                masterDuplicationData.pages[page.id] = newPage.id;

                for (const section of page.Sections) {
                    const newSection = await Section.create({
                        label: section.label,
                        order: section.order,
                        type: section.type,
                        model_id: newPage.id,
                        model_type: 'page',
                        orig_section_id: section.orig_section_id,
                    }, { transaction: t });
                    masterDuplicationData.sections[section.id] = newSection.id;
                    
                    // Initialize question key tracking for this section
                    sectionQuestionKeys[newSection.id] = new Set();

                    for (const question of section.Questions) {
                        let newQuestionId;
                        
                        // Generate question key if applicable
                        let questionKey = null;
                        if (question.question && question.type && !shouldSkipKeyGeneration(question.type)) {
                            questionKey = await generateQuestionKeyForCopy(
                                question.question, 
                                newSection.id, 
                                sectionQuestionKeys[newSection.id]
                            );
                        }
                        
                        const hasJsonData = question.options || question.details;
                        
                        if (hasJsonData) {
                            // Use raw query for questions with JSON fields
                            const [result] = await sequelize.query(
                                `INSERT INTO questions (
                                    section_id, label, type, required, question,
                                    options, details, \`order\`, prefill,
                                    has_not_available_option, second_booking_only,
                                    is_locked, ndis_only, question_key, created_at, updated_at
                                ) VALUES (
                                    :section_id, :label, :type, :required, :question,
                                    :options, :details, :order, :prefill,
                                    :has_not_available_option, :second_booking_only,
                                    :is_locked, :ndis_only, :question_key, NOW(), NOW()
                                )`,
                                {
                                    replacements: {
                                        section_id: newSection.id,
                                        label: question.label || '',
                                        type: question.type || 'text',
                                        required: Boolean(question.required),
                                        question: question.question || '',
                                        options: question.options ? JSON.stringify(question.options) : null,
                                        details: question.details ? JSON.stringify(question.details) : null,
                                        order: Number(question.order) || 0,
                                        prefill: Boolean(question.prefill),
                                        has_not_available_option: Boolean(question.has_not_available_option),
                                        second_booking_only: Boolean(question.second_booking_only),
                                        is_locked: Boolean(question.is_locked),
                                        ndis_only: Boolean(question.ndis_only),
                                        question_key: questionKey,
                                    },
                                    type: sequelize.QueryTypes.INSERT,
                                    transaction: t
                                }
                            );
                            newQuestionId = result;
                        } else {
                            // Use standard create for questions without JSON fields
                            const newQuestion = await Question.create({
                                section_id: newSection.id,
                                label: question.label || '',
                                type: question.type || 'text',
                                required: Boolean(question.required),
                                question: question.question || '',
                                options: null,
                                details: null,
                                order: Number(question.order) || 0,
                                prefill: Boolean(question.prefill),
                                has_not_available_option: Boolean(question.has_not_available_option),
                                second_booking_only: Boolean(question.second_booking_only),
                                is_locked: Boolean(question.is_locked),
                                ndis_only: Boolean(question.ndis_only),
                                question_key: questionKey,
                            }, { transaction: t });
                            newQuestionId = newQuestion.id;
                        }
                        
                        masterDuplicationData.questions[question.id] = newQuestionId;
                    }
                }
            }

            // Create dependencies
            const dependencyPromises = currentTemplate.Pages.flatMap(page =>
                page.Sections.flatMap(section =>
                    section.Questions.flatMap(question =>
                        question.QuestionDependencies.map(dependency =>
                            QuestionDependency.create({
                                question_id: masterDuplicationData.questions[question.id],
                                dependence_id: masterDuplicationData.questions[dependency.dependence_id],
                                answer: dependency.answer,
                            }, { transaction: t })
                        )
                    )
                )
            );

            await Promise.all(dependencyPromises);
            return newTemplate;
        }).then((newTemplate) => {
            console.log(`Template copied successfully. Original: ${currentTemplate.name} -> Copy: ${newTemplate.name} (ID: ${newTemplate.id})`);
            return res.status(200).json(newTemplate);
        }).catch((error) => {
            console.error('Transaction error:', {
                message: error.message,
                sqlMessage: error.parent?.sqlMessage,
                stack: error.stack
            });
            return res.status(400).json({ 
                error: error.message,
                sqlMessage: error.parent?.sqlMessage
            });
        });

    } catch (error) {
        console.error('General error:', {
            message: error.message,
            stack: error.stack
        });
        return res.status(500).json({ 
            error: error.message
        });
    }

    return res.status(400);
}