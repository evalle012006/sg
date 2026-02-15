import { BOOKING_TYPES } from "../../../components/constants";
import { Address, Booking, BookingEquipment, Course, Equipment, Guest, Page, QaPair, Question, QuestionDependency, Room, RoomType, Section, sequelize, Setting, Template } from "../../../models"
import { BookingService } from "../../../services/booking/booking";
import StorageService from "../../../services/storage/storage";

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

    const storage = new StorageService({ bucketType: 'restricted' });
    const optionType = question.option_type || 'funder';

    if (question.options && Array.isArray(question.options)) {
        const updatedOptions = await Promise.all(
            question.options.map(async (option) => {
                // ✅ For course options, verify course is not deleted
                if (optionType === 'course' && option.id) {
                    const course = await Course.findByPk(option.id);
                    if (!course || course.deleted_at) {
                        console.log(`⚠️ Skipping deleted course in options: ${option.id}`);
                        return null; // Exclude deleted courses from options
                    }
                }

                if (option.imageFilename) {
                    try {
                        let filePath;
                        if (optionType === 'course') {
                            filePath = `courses/${option.imageFilename}`;
                        } else {
                            filePath = `${optionType}/${option.imageFilename}`;
                        }
                        
                        option.imageUrl = await storage.getSignedUrl(filePath);
                    } catch (error) {
                        console.warn(`Failed to generate signed URL for: ${option.imageFilename}`, error);
                        option.imageUrl = null;
                    }
                }
                return option;
            })
        );

        // Filter out null options (deleted courses)
        question.options = updatedOptions.filter(option => option !== null);
    }

    return question;
}

/**
 * Process questions in a collection to refresh image URLs for card selection fields
 * @param {Array} questions - Array of question objects
 * @returns {Promise<Array>} - Questions with refreshed image URLs
 */
async function processQuestionsImageUrls(questions) {
    if (!questions || !Array.isArray(questions)) {
        return questions;
    }

    return await Promise.all(
        questions.map(async (question) => {
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
}

/**
 * Process template structure to refresh image URLs for all card selection questions
 * @param {Object} template - The template object with nested structure
 * @returns {Promise<Object>} - Template with refreshed image URLs
 */
async function processTemplateImageUrls(template) {
    if (!template) {
        return template;
    }

    // Convert to plain object if it's a Sequelize instance
    const plainTemplate = template.toJSON ? template.toJSON() : template;

    if (!plainTemplate.Pages) {
        return plainTemplate;
    }

    // Process all questions in all pages and sections
    const processedPages = await Promise.all(
        plainTemplate.Pages.map(async (page) => {
            if (!page.Sections) return page;
            
            const processedSections = await Promise.all(
                page.Sections.map(async (section) => {
                    if (!section.Questions) return section;
                    
                    const processedQuestions = await processQuestionsImageUrls(section.Questions);
                    
                    return {
                        ...section,
                        Questions: processedQuestions
                    };
                })
            );
            
            return {
                ...page,
                Sections: processedSections
            };
        })
    );

    return {
        ...plainTemplate,
        Pages: processedPages
    };
}

/**
 * Process booking structure to refresh image URLs for all card selection questions
 * @param {Object} booking - The booking object with nested structure
 * @returns {Promise<Object>} - Booking with refreshed image URLs
 */
async function processBookingImageUrls(booking) {
    if (!booking) {
        return booking;
    }

    // Convert to plain object if it's a Sequelize instance
    const plainBooking = booking.toJSON ? booking.toJSON() : booking;

    if (!plainBooking.Sections) {
        return plainBooking;
    }

    // Process all questions in booking sections
    const processedSections = await Promise.all(
        plainBooking.Sections.map(async (section) => {
            if (!section.QaPairs) return section;
            
            const processedQaPairs = await Promise.all(
                section.QaPairs.map(async (qaPair) => {
                    if (!qaPair.Question) return qaPair;
                    
                    const processedQuestion = await processQuestionsImageUrls([qaPair.Question]);
                    
                    return {
                        ...qaPair,
                        Question: processedQuestion[0]
                    };
                })
            );
            
            return {
                ...section,
                QaPairs: processedQaPairs
            };
        })
    );

    return {
        ...plainBooking,
        Sections: processedSections
    };
}

async function syncBookingSectionsWithTemplate(bookingId) {
    try {
        console.log("Syncing sections with template for booking:", bookingId);
        
        // Get existing booking sections
        const existingBookingSections = await Section.findAll({
            where: {
                model_type: 'booking',
                model_id: bookingId
            }
        });
        
        // Check if sections exist
        if (existingBookingSections.length > 0) {
            // If sections exist, find the template they're associated with
            console.log(`Found ${existingBookingSections.length} existing sections`);
            
            // Take the first section to find its original template
            const firstSection = existingBookingSections[0];
            
            if (!firstSection.orig_section_id) {
                console.error("No original section ID found");
                return false;
            }
            
            // Find the original section in the template
            const origSection = await Section.findOne({
                where: { id: firstSection.orig_section_id }
            });
            
            if (!origSection) {
                console.error("Original section not found");
                return false;
            }
            
            // Find all template sections from the same page
            let pageId = null;
            let templateId = null;
            if (origSection.model_type === 'page') {
                pageId = origSection.model_id;
                const parentPage = await Page.findOne({
                    where: { id: pageId }
                });

                if (parentPage) {
                    templateId = parentPage.template_id;
                }
            }
            
            if (!pageId) {
                console.error("Could not determine page ID for template");
                return false;
            }

            if (!templateId) {
                console.error("Could not determine template ID for template");
                return false;
            }
            
            console.log("Found template ID:", templateId);
            
            // Get the complete template with all pages and sections
            const template = await Template.findOne({
                where: { id: templateId },
                include: [{
                    model: Page,
                    include: [{
                        model: Section
                    }]
                }],
                order: [
                    [Page, 'order', 'ASC'],
                    [Page, Section, 'order', 'ASC']
                ]
            });
            
            if (!template) {
                console.error("Template not found with ID:", templateId);
                return false;
            }
            
            // Collect all sections from all pages in the template
            const allTemplateSections = [];
            template.Pages.forEach(page => {
                page.Sections.forEach(section => {
                    allTemplateSections.push(section);
                });
            });
            
            console.log(`Found ${allTemplateSections.length} sections in template`);
            
            // Get template sections that don't exist in the booking
            const existingOrigSectionIds = existingBookingSections.map(s => s.orig_section_id);
            // console.log("Existing section IDs:", existingOrigSectionIds);
            
            const sectionsToCreate = [];
            
            allTemplateSections.forEach(section => {
                if (!existingOrigSectionIds.includes(section.id)) {
                    console.log("Creating missing section:", section.id, section.label);
                    sectionsToCreate.push({
                        label: section.label,
                        order: section.order,
                        model_type: 'booking',
                        model_id: bookingId,
                        type: section.type,
                        orig_section_id: section.id,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                } else {
                    // console.log("Section already exists:", section.id, section.label);
                }
            });
            
            // Create missing sections
            if (sectionsToCreate.length > 0) {
                const transaction = await sequelize.transaction();
                try {
                    await Section.bulkCreate(sectionsToCreate, { transaction });
                    await transaction.commit();
                    console.log(`Created ${sectionsToCreate.length} missing sections`);
                    return true;
                } catch (error) {
                    await transaction.rollback();
                    console.error("Error creating missing sections:", error);
                    return false;
                }
            } else {
                console.log("No missing sections to create");
            }
        }
        
        return true;
    } catch (error) {
        console.error("Error in syncBookingSectionsWithTemplate:", error);
        return false;
    }
}

export default async function handler(req, res) {
    const { bookingId, prevBookingId } = req.query;

    let template = [];
    let booking = [];
    let bookingData;
    let currentBooking;
    if (prevBookingId !== 'undefined') {
        // check if there is a previous booking and load it...
        const currentBookingData = await Booking.findOne({ where: { uuid: bookingId } });
        bookingData = await Booking.findOne({ where: { uuid: prevBookingId } });

        if (currentBookingData?.id) {
            await syncBookingSectionsWithTemplate(currentBookingData.id);

            currentBooking = await Booking.findOne({
                where: { id: currentBookingData?.id },
                include: [
                    {
                        model: Section,
                        include: [
                            {
                                model: QaPair,
                                include: [
                                    {
                                        model: Question,
                                        include: [
                                            {
                                                model: QuestionDependency,
                                                include: ['dependency']
                                            }
                                        ],
                                        raw: true
                                    }
                                ]
                            }
                        ],
                        order: [['order', 'ASC']]
                    },
                    {
                        model: Guest,
                        attributes: { exclude: ['password', 'email_verified'] },
                        include: Address
                    },
                    { 
                        model: Room, 
                        include: RoomType 
                    }
                ],
            });
        }
    } else if (bookingId) {
        bookingData = await Booking.findOne({ where: { uuid: bookingId } });

        if (bookingData?.id) {
            await syncBookingSectionsWithTemplate(bookingData.id);
        }
    }

    if (bookingData?.id) {
        booking = await Booking.findOne({
            where: { id: bookingData.id },
            include: [
                {
                    model: Section,
                    include: [
                        {
                            model: QaPair,
                            include: [
                                {
                                    model: Question,
                                    include: [
                                        {
                                            model: QuestionDependency,
                                            include: ['dependency']
                                        }
                                    ],
                                    raw: true
                                }
                            ]
                        }
                    ],
                    order: [['order', 'ASC']]
                },
                {
                    model: Guest,
                    attributes: { exclude: ['password', 'email_verified'] },
                    include: Address
                },
                { 
                    model: Room, 
                    include: RoomType 
                }
            ],
        });
    }

    let completedEquipments = false;
    if (currentBooking && currentBooking.Sections.length == 0) {
        const defaultTemplate = await Setting.findOne({ where: { attribute: 'default_template' } });

        template = await Template.findOne({
            where: { id: defaultTemplate.value },
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
            order: [
                [Page, 'order', 'ASC'],
                [Page, Section, 'order', 'ASC']
            ]
         });
    } else {
        const bookingService = new BookingService();
        template = currentBooking ? await bookingService.getBookingTemplate(currentBooking, true) : await bookingService.getBookingTemplate(booking, true);

        if (currentBooking || booking) {
            const id = currentBooking?.id || booking?.id;
            const bookingType = currentBooking?.type || booking?.type;
            if (bookingType === BOOKING_TYPES.FIRST_TIME_GUEST) {
                const bookingEquipments = await BookingEquipment.findAll({ where: { booking_id: id } });
                completedEquipments = bookingEquipments.length > 0;
            } else {
                // Check for acknowledgement-type equipments specifically
                const acknowledgementEquipments = await BookingEquipment.findAll({ 
                    where: { booking_id: id },
                    include: [{
                        model: Equipment,
                        where: { type: 'acknowledgement' },
                        required: true
                    }]
                });
                
                completedEquipments = acknowledgementEquipments.length > 0;
            }
        }

        if (!completedEquipments && (currentBooking || booking)) {
            const uuid = currentBooking?.uuid || booking?.uuid;
            completedEquipments = await bookingService.isBookingComplete(uuid);
        }
    }

    try {
        // Process all the data to include image URLs for card selection questions
        const [processedTemplate, processedBooking, processedCurrentBooking] = await Promise.all([
            template ? processTemplateImageUrls(template) : null,
            booking ? processBookingImageUrls(booking) : null,
            currentBooking ? processBookingImageUrls(currentBooking) : null
        ]);

        return res.status(200).json({ 
            template: processedTemplate || template, 
            booking: processedBooking || booking, 
            newBooking: processedCurrentBooking || currentBooking, 
            completedEquipments: completedEquipments 
        });
    } catch (error) {
        console.error('Error processing image URLs in booking API:', error);
        // Return original data if processing fails
        return res.status(200).json({ 
            template: template, 
            booking: booking, 
            newBooking: currentBooking, 
            completedEquipments: completedEquipments 
        });
    }
}