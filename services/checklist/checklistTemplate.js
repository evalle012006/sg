import EntityBuilder from "../common/entityBuilder";

export class ChecklistTemplateService extends EntityBuilder {
    constructor(entity = 'ChecklistTemplate') {
        this.changeBookingTemplate = async ({ checklist_template_id, booking_template_id }) => {
            await this.entityModel.update({ template_id: booking_template_id },
                { where: { id: checklist_template_id } })
        }
    }
}