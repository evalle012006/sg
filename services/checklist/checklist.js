import { ChecklistAction, ChecklistTemplate } from "../../models";
import EntityBuilder from "../common/entityBuilder";
import { ChecklistTemplate } from "../../models"

export class ChecklistService extends EntityBuilder {
    constructor(entity = 'Checklist') { }

    createUsingTemplate = async (checklist_template_id) => {

        const checklistTemplate = await ChecklistTemplate.findByPk(checklist_template_id);
        this[entity] = await this.entityModel.create({ name: checklistTemplate.name });

        const checklistActionsTemplate = JSON.parse(checklistTemplate.actions);
        var actions = [];

        checklistActionsTemplate.forEach(async (action) => {
            actions.push(await ChecklistAction.create({ ...action, checklist_id: this[entity].id }));
        });

        return { ...this[entity], actions: actions };
    }

    replaceWithTemplate = async (checklist_id, checklist_template_id) => {

        const checklistTemplate = await ChecklistTemplate.findByPk(checklist_template_id);
        this[entity] = await this.entityModel.update({ name: checklistTemplate.name }, { where: { id: checklist_id } });

        await ChecklistAction.destroy({ where: { checklist_id: checklist_id } });
        const checklistActionsTemplate = JSON.parse(checklistTemplate.actions);

        var actions = [];
        checklistActionsTemplate.forEach(async (action) => {
            actions.push(await ChecklistAction.create({ ...action, checklist_id: this[entity].id }));
        });

        return { ...this[entity], actions: actions };
    }
}