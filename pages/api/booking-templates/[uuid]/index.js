import { Page, Question, Section, Template, sequelize, Sequelize, QuestionDependency } from "./../../../../models"
import StorageService from "../../../../services/storage/storage";

// Question types that have image options that need URL refresh
const CARD_SELECTION_TYPES = ['card-selection', 'card-selection-multi', 'horizontal-card', 'horizontal-card-multi'];

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

/**
 * Process all questions in a template to refresh image URLs for card selection fields
 * @param {Object} template - The template object with nested structure
 * @returns {Promise<Object>} - Template with refreshed image URLs
 */
async function processTemplateImageUrls(template) {
    if (!template || !template.Pages) {
        return template;
    }

    // Process all questions in all pages and sections
    const processedPages = await Promise.all(
        template.Pages.map(async (page) => {
            if (!page.Sections) return page;
            
            const processedSections = await Promise.all(
                page.Sections.map(async (section) => {
                    if (!section.Questions) return section;
                    
                    const processedQuestions = await Promise.all(
                        section.Questions.map(async (question) => {
                            // Convert to plain object if it's a Sequelize instance
                            const plainQuestion = question.toJSON ? question.toJSON() : question;
                            
                            // Set default option_type for backward compatibility if not set
                            if (CARD_SELECTION_TYPES.includes(plainQuestion.type) && !plainQuestion.option_type) {
                                plainQuestion.option_type = 'funder';
                            }
                            
                            // Refresh image URLs for card selection questions
                            if (CARD_SELECTION_TYPES.includes(plainQuestion.type)) {
                                return await refreshImageUrls(plainQuestion);
                            }
                            
                            return plainQuestion;
                        })
                    );
                    
                    return {
                        ...section.toJSON ? section.toJSON() : section,
                        Questions: processedQuestions
                    };
                })
            );
            
            return {
                ...page.toJSON ? page.toJSON() : page,
                Sections: processedSections
            };
        })
    );

    return {
        ...template.toJSON ? template.toJSON() : template,
        Pages: processedPages
    };
}

export default async function handler(req, res) {
    const { uuid } = req.query;

    if (req.method === "DELETE") {
        const template = await Template.findOne({ where: { uuid } });

        await sequelize.transaction(async (t) => {
            const deletePages = await Page.destroy({ where: { template_id: template.id } }, { transaction: t });
            const deleteTemplate = await Template.destroy({
                where: {
                    uuid,
                },
            }, { transaction: t });

            await sequelize.query("SET foreign_key_checks = 0");
            await sequelize.query("DELETE FROM sections where model_type = 'page' and model_id not in (select id from pages)");
            await sequelize.query("DELETE FROM questions where section_id not in (select id from sections)");
            await sequelize.query("DELETE FROM question_dependencies where question_id not in (select id from questions)");
            await sequelize.query("SET foreign_key_checks = 1");
            if (deleteTemplate) res.status(200).json({ message: "success" });
        });

    }

    if (req.method === "POST") {
        await Template.update(req.body, { where: { uuid } });
    }

    // Fetch the template with all nested data
    const template = await Template.findOne({
        where: { uuid },
        include: [{
          model: Page,
          include: [{
            model: Section,
            include: [{
              model: Question,
              include: [{
                model: QuestionDependency,
                include: ['dependency']
              }],
              raw: true
            }]
          }]
        }],
        order: [[Page, 'order', 'ASC']]
    });

    if (!template) {
        return res.status(404).json({ error: "Template not found" });
    }

    try {
        // Process the template to refresh image URLs for card selection questions
        const processedTemplate = await processTemplateImageUrls(template);
        return res.status(200).json(processedTemplate);
    } catch (error) {
        console.error('Error processing template image URLs:', error);
        // Return original template if processing fails
        return res.status(200).json(template);
    }
}