export default class EntityBuilder {
    constructor(entity) {
        this[entity] = null;
        this.entityModel = require('../../models')[entity];

        this.create = async (data) => {
            this[entity] = await this.entityModel.create(data);
            return this[entity];
        };

        this.update = async (data) => {
            this[entity] = await this.entityModel.findOne({ where: { id: data.id } });
            this[entity].update(data);
            return this[entity];
        };

        this.get = async (entity_id) => {
            this[entity] = await this.entityModel.findByPk(entity_id);
            return this[entity];
        };

        this.delete = async (entity_id) => {
            return await this.entityModel.destroy({ where: { id: entity_id } });
        };
    }
}