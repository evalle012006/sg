import { Question, QaPair, QuestionDependency, sequelize } from "../../../../models";
import { Op } from 'sequelize'
import StorageService from "../../../../services/storage/storage";

// Question types that should skip question_key generation
const SKIP_KEY_GENERATION_TYPES = ['url', 'file-upload', 'health-info', 'goal-table', 'care-table'];

// Question types that have image options that need URL refresh
const CARD_SELECTION_TYPES = ['card-selection', 'card-selection-multi', 'horizontal-card', 'horizontal-card-multi'];

/**
 * Generate a unique question key from question text within a specific scope
 * @param {string} questionText - The question text
 * @param {number} sectionId - The section ID for scoped uniqueness
 * @param {number} questionId - Optional question ID to exclude from uniqueness check
 * @returns {Promise<string>} - Generated unique question key
 */
async function generateQuestionKey(questionText, sectionId, questionId = null) {
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
        const whereClause = { 
            question_key: questionKey,
            section_id: sectionId
        };
        if (questionId) {
            whereClause.id = { [Op.ne]: questionId };
        }

        const existingQuestion = await Question.findOne({
            where: whereClause
        });

        if (!existingQuestion) {
            break;
        }

        questionKey = `${baseKey}-${suffix}`;
        suffix++;
    }

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

/**
 * Refresh image URLs for card selection options with dynamic file paths
 * @param {Object} question - The question object
 * @returns {Promise<Object>} - Question with refreshed image URLs
 */
async function refreshImageUrls(question) {
    if (!question || !CARD_SELECTION_TYPES.includes(question.type)) {
        return question;
    }

    // Initialize storage service
    const storage = new StorageService({ bucketType: 'restricted' });

    // Get the option type, default to 'funder' for backward compatibility
    const optionType = question.option_type || 'funder';

    // Process options if they exist
    if (question.options && Array.isArray(question.options)) {
        const updatedOptions = await Promise.all(
            question.options.map(async (option) => {
                if (option.imageFilename) {
                    try {
                        // Generate fresh signed URL for the image using appropriate path
                        let filePath;
                        if (optionType === 'course') {
                            // For course options, use 'courses/' directory (matching existing course storage)
                            filePath = `courses/${option.imageFilename}`;
                        } else {
                            // For funder and other options, use the option_type directory
                            filePath = `${optionType}/${option.imageFilename}`;
                        }
                        
                        option.imageUrl = await storage.getSignedUrl(filePath);
                    } catch (error) {
                        console.warn(`Failed to generate signed URL for image: ${option.imageFilename} in ${optionType}/`, error);
                        // Keep the original imageUrl or set to null if generation fails
                        option.imageUrl = null;
                    }
                }
                return option;
            })
        );
        
        return {
            ...question,
            options: updatedOptions
        };
    }

    return question;
}

export default async function handler(req, res) {
    const { question_id } = req.query;

    if (req.method === "POST") {
        try {
            const updateData = { ...req.body };
            
            // Generate question_key if question text is being updated and type allows it
            if (updateData.question && updateData.type && !shouldSkipKeyGeneration(updateData.type)) {
                // Get current question to get section_id if not provided
                const currentQuestion = await Question.findOne({ where: { id: question_id } });
                const sectionId = updateData.section_id || currentQuestion?.section_id;
                
                if (sectionId && currentQuestion.question_key == null) {
                    const newQuestionKey = await generateQuestionKey(updateData.question, sectionId, question_id);
                    if (newQuestionKey) {
                        updateData.question_key = newQuestionKey;
                    }
                }
            } else if (updateData.type && shouldSkipKeyGeneration(updateData.type)) {
                // If changing to a type that should skip key generation, clear the key
                updateData.question_key = null;
            }

            // Special handling for card selection options with images
            if (updateData.options && CARD_SELECTION_TYPES.includes(updateData.type)) {
                // Process options to handle image storage
                const processedOptions = updateData.options.map(option => {
                    // Only store imageFilename in database, never imageUrl
                    const processedOption = {
                        label: option.label,
                        value: option.value,
                        description: option.description || '',
                        imageFilename: option.imageFilename || null
                        // Note: imageUrl is NOT saved to database, only generated on fetch
                    };
                    
                    return processedOption;
                });
                updateData.options = processedOptions;
            }

            // Set default option_type for card selection fields if not provided
            if (CARD_SELECTION_TYPES.includes(updateData.type) && !updateData.option_type) {
                updateData.option_type = 'funder'; // Default to funder for backward compatibility
            }

            await Question.update(updateData, { where: { id: question_id } });

            let question = await Question.findOne({ where: { id: question_id } });
            
            // Convert to plain object to avoid Sequelize instance issues
            question = question.toJSON();
            
            // ALWAYS refresh image URLs for card selection questions after update
            if (CARD_SELECTION_TYPES.includes(question.type)) {
                question = await refreshImageUrls(question);
            }

            return res.status(200).json(question);
        } catch (error) {
            console.error('Error updating question:', error);
            return res.status(500).json({ 
                error: 'Failed to update question', 
                details: error.message 
            });
        }
    }
    
    if (req.method === "GET") {
        try {
            let question = await Question.findOne({ where: { id: question_id } });
            
            if (!question) {
                return res.status(404).json({ error: "Question not found" });
            }
            
            // Convert to plain object
            question = question.toJSON();
            
            // Set default option_type for backward compatibility if not set
            if (CARD_SELECTION_TYPES.includes(question.type) && !question.option_type) {
                question.option_type = 'funder';
            }
            
            // ALWAYS refresh image URLs for card selection questions on GET
            if (CARD_SELECTION_TYPES.includes(question.type)) {
                question = await refreshImageUrls(question);
            }

            return res.status(200).json(question);
        } catch (error) {
            console.error('Error fetching question:', error);
            return res.status(500).json({ 
                error: 'Failed to fetch question', 
                details: error.message 
            });
        }
    }
    
    if (req.method === "DELETE") {
        try {
            const question = await Question.findOne({ where: { id: question_id } });

            if (question) {
                // Clean up any images associated with card selection questions before deletion
                if (CARD_SELECTION_TYPES.includes(question.type) && question.options) {
                    const optionType = question.option_type || 'funder';
                    const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
                    
                    // Delete any associated images
                    for (const option of options) {
                        if (option.imageFilename) {
                            try {
                                await fetch(`/api/storage/upload?filename=${option.imageFilename}&filepath=${optionType}/`, {
                                    method: 'DELETE'
                                });
                            } catch (error) {
                                console.warn(`Failed to delete image ${option.imageFilename} during question deletion:`, error);
                            }
                        }
                    }
                }

                await sequelize.transaction(async (t) => {
                    await QaPair.destroy({ 
                        where: { question_id: question.id } 
                    }, { transaction: t });
                    
                    await QuestionDependency.destroy({ 
                        where: { 
                            [Op.or]: [
                                { question_id: question.id },
                                { dependence_id: question.id }
                            ] 
                        } 
                    }, { transaction: t });
                    
                    await Question.destroy({ 
                        where: { id: question_id } 
                    }, { transaction: t });
                });

                return res.status(200).json({ message: "success" });
            } else {
                return res.status(404).json({ error: "Question not found" });
            }
        } catch (error) {
            console.error('Error deleting question:', error);
            return res.status(500).json({ 
                error: 'Failed to delete question', 
                details: error.message 
            });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}