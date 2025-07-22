import EntityBuilder from "../../common/entityBuilder";
import { Op } from sequelize;
export class QuestionService extends EntityBuilder {
    constructor(entity = 'Question') {
        this.questions = [];
    }

    updateOrder = async ({ question_id, new_position }) => {
        this[entity] = await this.entityModel.findByPk(question_id);
        // fetch all questions in the current page after the current order position
        this.questions = await this.entityModel.findAll({ where: { page_id: this[entity].page_id, [Op.ne]: [{ id: this[entity].id }] }, order: ['order', 'ASC'] });

        // if the position has increased in order, sort the questions above new position 
        if (this[entity].order > new_position) {
            this.questions.slice(0, new_position + 1).forEach(async (question, index) => {
                await question.update({ order: index + 1 });
            })

            this[entity].update({ order: new_position })
        }

        // if the position has decreased in order sort the questions below new position
        if (this[entity].order < new_position) {
            this.questions.slice(new_position + 1).forEach(async (question, index) => {
                await question.update({ order: new_position + index + 1 });
            })

            this[entity].update({ order: new_position })
        }
    }

    changePage = async ({ question_id, page_id }) => {
        await this.entityModel.update({ page_id: page_id },
            { where: { id: question_id } })
    }

}