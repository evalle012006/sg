import { Page, Question, Section, Setting, Template, sequelize } from "../../../models"

export default async function handler(req, res) {
    const { bookingId } = req.body;

    if (req.method !== "POST" || !bookingId) {
        return res.status(400).json({ success: false, message: "Invalid request" });
    }

    try {
        // Get template with all relations in a single query
        const defaultTemplate = await Setting.findOne({ 
            where: { attribute: 'default_template' } 
        });
        
        if (!defaultTemplate?.value) {
            return res.status(404).json({ success: false, message: "Default template not found" });
        }

        const template = await Template.findOne({ 
            where: { id: defaultTemplate.value }, 
            include: [{
                model: Page, 
                include: [{
                    model: Section,
                    include: [Question]
                }]
            }]
        });

        if (!template) {
            return res.status(404).json({ success: false, message: "Template not found" });
        }

        // Extract all sections from all pages to prepare bulk insert
        const allSections = [];
        const sectionIds = [];
        
        template.Pages.forEach(page => {
            page.Sections.forEach(section => {
                sectionIds.push(section.id);
                allSections.push({
                    label: section.label,
                    order: section.order,
                    model_type: 'booking',
                    model_id: bookingId,
                    type: section.type,
                    orig_section_id: section.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });
        });

        // Find existing sections in a single query
        const existingSections = await Section.findAll({ 
            where: {
                model_type: 'booking', 
                model_id: bookingId, 
                orig_section_id: sectionIds
            },
            attributes: ['orig_section_id']
        });

        // Filter out sections that already exist
        const existingSectionIds = existingSections.map(section => section.orig_section_id);
        const sectionsToCreate = allSections.filter(section => 
            !existingSectionIds.includes(section.orig_section_id)
        );

        // Bulk create sections if needed
        if (sectionsToCreate.length > 0) {
            const transaction = await sequelize.transaction();
            try {
                await Section.bulkCreate(sectionsToCreate, { transaction });
                await transaction.commit();
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        }

        return res.status(201).json({ success: true });
    } catch (error) {
        console.error("Error in template handler:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}